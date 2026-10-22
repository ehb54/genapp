#!/usr/bin/env python3
"""Small, dependency-free AI provider client.

The client deliberately reads secrets only from the service environment and
never includes them in returned values or error messages.
"""

import json
import os
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass


DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class ProviderError(RuntimeError):
    pass


def _env_name(prefix, suffix):
    return "%s_%s" % (str(prefix).strip().upper(), suffix)


def provider_kind(url, explicit=""):
    kind = str(explicit or "").strip().lower()
    if kind:
        return kind
    if "openrouter.ai" in str(url):
        return "openrouter"
    if "generativelanguage.googleapis.com" in str(url) or ":generateContent" in str(url):
        return "gemini"
    return "generic"


@dataclass(frozen=True)
class ProviderConfig:
    url: str
    api_key: str
    kind: str
    model: str
    auth_header: str = "Authorization"
    auth_scheme: str = "Bearer"
    http_referer: str = ""
    title: str = ""
    timeout_seconds: int = 120
    max_output_tokens: int = 1200

    @classmethod
    def from_env(cls, prefix="AI_HELPER"):
        get = lambda suffix, default="": os.environ.get(_env_name(prefix, suffix), default).strip()
        url = get("PROVIDER_URL")
        api_key = get("API_KEY")
        try:
            timeout = max(5, min(300, int(get("TIMEOUT_SECONDS", "120"))))
        except ValueError:
            timeout = 120
        try:
            max_tokens = max(0, min(16384, int(get("MAX_OUTPUT_TOKENS", "1200"))))
        except ValueError:
            max_tokens = 1200
        return cls(
            url=url,
            api_key=api_key,
            kind=provider_kind(url, get("PROVIDER")),
            model=get("MODEL"),
            auth_header=get("AUTH_HEADER", "Authorization") or "Authorization",
            auth_scheme=get("AUTH_SCHEME", "Bearer"),
            http_referer=get("HTTP_REFERER"),
            title=get("X_TITLE"),
            timeout_seconds=timeout,
            max_output_tokens=max_tokens,
        )

    @property
    def configured(self):
        return bool(self.url and self.api_key)

    def headers(self, session_id=""):
        value = "%s %s" % (self.auth_scheme, self.api_key) if self.auth_scheme else self.api_key
        headers = {"Content-Type": "application/json", self.auth_header: value}
        if self.http_referer:
            headers["HTTP-Referer"] = self.http_referer
        if self.title:
            headers["X-Title"] = self.title
        if self.kind == "openrouter" and session_id:
            headers["X-Session-Id"] = session_id
        return headers


def post_json(url, payload, headers, timeout=120, max_response_bytes=DEFAULT_MAX_RESPONSE_BYTES):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=dict(headers), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read(max_response_bytes).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        detail = error.read(4096).decode("utf-8", errors="replace")
        raise ProviderError("provider returned HTTP %s: %s" % (error.code, detail[:500]))
    except (TimeoutError, socket.timeout):
        raise TimeoutError("provider request timed out after %s seconds" % timeout)
    except Exception as error:
        if "timed out" in str(error).lower():
            raise TimeoutError("provider request timed out after %s seconds" % timeout)
        raise ProviderError("provider request failed: %s" % error)


class ProviderClient:
    def __init__(self, config):
        self.config = config

    @classmethod
    def from_env(cls, prefix="AI_HELPER"):
        return cls(ProviderConfig.from_env(prefix))

    def chat(self, messages, tools=None, tool_choice=None, session_id="", max_output_tokens=None):
        if not self.config.configured:
            raise ProviderError("AI provider is not configured")
        if self.config.kind == "gemini":
            if tools:
                raise ProviderError("configured Gemini endpoint does not support this tool contract")
            prompt = "\n\n".join(
                "%s:\n%s" % (item.get("role", "user"), item.get("content", ""))
                for item in messages
            )
            body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
            limit = self.config.max_output_tokens if max_output_tokens is None else int(max_output_tokens)
            if limit > 0:
                body["generationConfig"] = {"maxOutputTokens": limit}
        else:
            body = {"messages": list(messages)}
            if self.config.model:
                body["model"] = self.config.model
            limit = self.config.max_output_tokens if max_output_tokens is None else int(max_output_tokens)
            if limit > 0:
                body["max_tokens"] = limit
            if tools:
                body["tools"] = list(tools)
            if tool_choice is not None:
                body["tool_choice"] = tool_choice
            if session_id:
                body["session_id"] = session_id
        raw = post_json(
            self.config.url,
            body,
            self.config.headers(session_id),
            self.config.timeout_seconds,
        )
        try:
            decoded = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ProviderError("provider returned invalid JSON") from error
        if self.config.kind == "gemini":
            parts = []
            for candidate in decoded.get("candidates") or []:
                parts.extend((candidate.get("content") or {}).get("parts") or [])
            return {
                "message": {"role": "assistant", "content": "\n".join(str(part.get("text")) for part in parts if part.get("text"))},
                "usage": decoded.get("usageMetadata") or {},
                "raw_id": decoded.get("responseId"),
            }
        choices = decoded.get("choices") or []
        if not choices or not isinstance(choices[0].get("message"), dict):
            raise ProviderError("provider returned no assistant message")
        return {
            "message": choices[0]["message"],
            "usage": decoded.get("usage") or {},
            "raw_id": decoded.get("id"),
        }
