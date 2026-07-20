#!/usr/bin/env python3
import json
import os
import socket
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent
ENV_PATH = SERVICE_DIR / ".env"
USAGE_PATH = SERVICE_DIR / "usage.json"
MAX_BODY_BYTES = 262144
DEFAULT_PROVIDER_TIMEOUT_SECONDS = 45
DEFAULT_MAX_OUTPUT_TOKENS = 800


def load_env(path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def json_response(handler, status, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def configured_provider():
    url = os.environ.get("AI_HELPER_PROVIDER_URL", "").strip()
    key = os.environ.get("AI_HELPER_API_KEY", "").strip()
    return url, key


def provider_kind(url):
    explicit = os.environ.get("AI_HELPER_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if "openrouter.ai" in url:
        return "openrouter"
    if "generativelanguage.googleapis.com" in url or ":generateContent" in url:
        return "gemini"
    return "generic"


def provider_headers(api_key):
    headers = {"Content-Type": "application/json"}
    header_name = os.environ.get("AI_HELPER_AUTH_HEADER", "Authorization").strip() or "Authorization"
    scheme = os.environ.get("AI_HELPER_AUTH_SCHEME", "Bearer").strip()
    headers[header_name] = f"{scheme} {api_key}" if scheme else api_key
    referer = os.environ.get("AI_HELPER_HTTP_REFERER", "").strip()
    title = os.environ.get("AI_HELPER_X_TITLE", "").strip()
    if referer:
        headers["HTTP-Referer"] = referer
    if title:
        headers["X-Title"] = title
    return headers


def env_int(name, default, minimum=None, maximum=None):
    try:
        value = int(str(os.environ.get(name, "")).strip() or default)
    except Exception:
        value = int(default)
    if minimum is not None and value < minimum:
        value = minimum
    if maximum is not None and value > maximum:
        value = maximum
    return value


def ai_helper_prompt(payload):
    safe_payload = json.dumps(payload, indent=2, sort_keys=True)
    question = str(payload.get("user_question") or "")
    return """You are a read-only AI Helper for the SASSIE/ZAZZIE GenApp UI.
Use the provided page context to answer the user's question.
Do not claim to run SASSIE jobs, do not modify form values, and do not ask for API keys.

GenApp context JSON:
%s

User question:
%s
""" % (safe_payload, question)


def provider_request_body(kind, payload):
    max_output_tokens = env_int("AI_HELPER_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS, 0, 4096)
    if kind == "gemini":
        request = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": ai_helper_prompt(payload)}
                    ]
                }
            ]
        }
        if max_output_tokens > 0:
            request["generationConfig"] = {"maxOutputTokens": max_output_tokens}
        return request
    if kind == "openrouter":
        model = os.environ.get("AI_HELPER_MODEL", "").strip() or "deepseek/deepseek-v4-flash"
        request = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": ai_helper_prompt(payload)
                }
            ]
        }
        if max_output_tokens > 0:
            request["max_tokens"] = max_output_tokens
        return request
    return payload


def parse_provider_response(kind, response_body):
    try:
        decoded = json.loads(response_body)
    except json.JSONDecodeError:
        return {"message": response_body}

    if kind == "gemini" and isinstance(decoded, dict):
        texts = []
        for candidate in decoded.get("candidates") or []:
            content = candidate.get("content") or {}
            for part in content.get("parts") or []:
                text = part.get("text")
                if text:
                    texts.append(str(text))
        usage = gemini_usage(decoded.get("usageMetadata") or {})
        if texts:
            payload = {"message": "\n".join(texts)}
            if usage:
                payload["usage"] = usage
            return payload
        prompt_feedback = decoded.get("promptFeedback") or decoded.get("prompt_feedback")
        if prompt_feedback:
            payload = {"message": "Gemini returned no text.", "provider_feedback": prompt_feedback}
            if usage:
                payload["usage"] = usage
            return payload
        payload = {"message": "Gemini returned no text."}
        if usage:
            payload["usage"] = usage
        return payload

    if kind == "openrouter" and isinstance(decoded, dict):
        message = ""
        choices = decoded.get("choices") or []
        if choices:
            first = choices[0] or {}
            choice_message = first.get("message") or {}
            message = choice_message.get("content") or first.get("text") or ""
        payload = {"message": str(message) if message else "OpenRouter returned no text."}
        usage = openrouter_usage(decoded.get("usage") or {})
        if usage:
            payload["usage"] = usage
        return payload

    if isinstance(decoded, dict):
        return decoded
    return {"message": str(decoded)}


def add_cumulative_usage(payload):
    if not isinstance(payload, dict):
        return payload
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return payload
    add_cost_estimate(usage)
    total_tokens = usage.get("total_tokens")
    if not isinstance(total_tokens, int) or total_tokens <= 0:
        return payload
    cumulative = record_cumulative_usage(usage)
    if cumulative:
        usage.update(cumulative)
    return payload


def add_cost_estimate(usage):
    input_tokens = usage.get("input_tokens") if isinstance(usage.get("input_tokens"), int) else 0
    output_tokens = usage.get("output_tokens") if isinstance(usage.get("output_tokens"), int) else 0
    input_rate, output_rate, source = cost_rates()
    if input_rate is None or output_rate is None:
        return
    estimated = (input_tokens * input_rate + output_tokens * output_rate) / 1000000.0
    usage["estimated_cost_usd"] = round(estimated, 8)
    usage["cost_basis"] = {
        "input_usd_per_1m": input_rate,
        "output_usd_per_1m": output_rate,
        "source": source
    }


def cost_rates():
    input_override = float_env("AI_HELPER_INPUT_USD_PER_1M")
    output_override = float_env("AI_HELPER_OUTPUT_USD_PER_1M")
    if input_override is not None and output_override is not None:
        return input_override, output_override, "env"
    model = os.environ.get("AI_HELPER_MODEL", "").strip()
    if model == "deepseek/deepseek-v4-flash":
        return 0.084, 0.168, "openrouter_list_price_2026-07-20"
    if model == "deepseek/deepseek-v4-flash:free":
        return 0.0, 0.0, "openrouter_free_model"
    return None, None, ""


def float_env(name):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    return value if value >= 0 else None


def record_cumulative_usage(usage):
    current_tokens = 0
    current_cost = 0.0
    try:
        if USAGE_PATH.exists():
            decoded = json.loads(USAGE_PATH.read_text(encoding="utf-8"))
            if isinstance(decoded, dict) and isinstance(decoded.get("account_cumulative_tokens"), int):
                current_tokens = decoded["account_cumulative_tokens"]
            if isinstance(decoded, dict) and isinstance(decoded.get("account_cumulative_cost_usd"), (int, float)):
                current_cost = float(decoded["account_cumulative_cost_usd"])
    except Exception:
        current_tokens = 0
        current_cost = 0.0
    updated_tokens = current_tokens + int(usage.get("total_tokens") or 0)
    updated_cost = current_cost
    if isinstance(usage.get("estimated_cost_usd"), (int, float)):
        updated_cost += float(usage["estimated_cost_usd"])
    try:
        tmp_path = USAGE_PATH.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps({
            "account_cumulative_tokens": updated_tokens,
            "account_cumulative_cost_usd": round(updated_cost, 8)
        }, separators=(",", ":")) + "\n", encoding="utf-8")
        tmp_path.replace(USAGE_PATH)
    except Exception:
        return None
    return {
        "account_cumulative_tokens": updated_tokens,
        "account_cumulative_cost_usd": round(updated_cost, 8)
    }


def gemini_usage(metadata):
    if not isinstance(metadata, dict):
        return {}
    usage = {}
    if isinstance(metadata.get("promptTokenCount"), int):
        usage["input_tokens"] = metadata["promptTokenCount"]
    if isinstance(metadata.get("candidatesTokenCount"), int):
        usage["output_tokens"] = metadata["candidatesTokenCount"]
    if isinstance(metadata.get("totalTokenCount"), int):
        usage["total_tokens"] = metadata["totalTokenCount"]
    return usage


def openrouter_usage(metadata):
    if not isinstance(metadata, dict):
        return {}
    usage = {}
    prompt_tokens = metadata.get("prompt_tokens")
    completion_tokens = metadata.get("completion_tokens")
    total_tokens = metadata.get("total_tokens")
    if isinstance(prompt_tokens, int):
        usage["input_tokens"] = prompt_tokens
    if isinstance(completion_tokens, int):
        usage["output_tokens"] = completion_tokens
    if isinstance(total_tokens, int):
        usage["total_tokens"] = total_tokens
    return usage


def call_provider(payload):
    url, api_key = configured_provider()
    if not url or not api_key:
        module = payload.get("module") or "none"
        question = payload.get("user_question") or ""
        return {
            "message": "AI Helper service connected. Received module: %s. Received question: %s" % (module, question),
            "endpoint_state": "local_stub"
        }

    kind = provider_kind(url)
    timeout = env_int("AI_HELPER_TIMEOUT_SECONDS", DEFAULT_PROVIDER_TIMEOUT_SECONDS, 5, 120)
    request_payload = provider_request_body(kind, payload)
    data = json.dumps(request_payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=provider_headers(api_key), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read(MAX_BODY_BYTES).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        detail = error.read(4096).decode("utf-8", errors="replace")
        raise RuntimeError("provider returned HTTP %s: %s" % (error.code, detail[:500]))
    except (TimeoutError, socket.timeout) as error:
        raise RuntimeError("provider request timed out after %s seconds" % timeout)
    except Exception as error:
        if "timed out" in str(error).lower():
            raise RuntimeError("provider request timed out after %s seconds" % timeout)
        raise RuntimeError("provider request failed: %s" % error)

    return add_cumulative_usage(parse_provider_response(kind, response_body))


class Handler(BaseHTTPRequestHandler):
    server_version = "GenAppAIHelper/0.2"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self):
        if self.path == "/health":
            url, api_key = configured_provider()
            json_response(self, 200, {
                "ok": True,
                "provider": provider_kind(url) if url else "local_stub",
                "provider_url_configured": bool(url),
                "api_key_configured": bool(api_key)
            })
            return
        json_response(self, 404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/ai-helper":
            json_response(self, 404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > MAX_BODY_BYTES:
            json_response(self, 413, {"error": "AI Helper request size is invalid."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            json_response(self, 400, {"error": "AI Helper request must be JSON."})
            return
        if not isinstance(payload, dict):
            json_response(self, 400, {"error": "AI Helper request must be a JSON object."})
            return
        try:
            json_response(self, 200, call_provider(payload))
        except Exception as error:
            json_response(self, 502, {"error": str(error)})


def main():
    load_env(ENV_PATH)
    host = os.environ.get("AI_HELPER_BIND_HOST", "127.0.0.1")
    port = int(os.environ.get("AI_HELPER_PORT", "8765") or "8765")
    server = ThreadingHTTPServer((host, port), Handler)
    print("AI Helper service listening on %s:%s" % (host, port), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
