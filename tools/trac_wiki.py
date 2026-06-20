#!/usr/bin/env python3
"""Mirror and publish GenApp Trac wiki pages."""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import xmlrpc.client
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
WIKI_ROOT = REPO_ROOT / "wiki_trac"
PAGES_ROOT = WIKI_ROOT / "pages"
ENV_PATH = WIKI_ROOT / ".env"
DEFAULT_BASE_URL = "https://genapp.rocks/wiki"
DEFAULT_XMLRPC_URL = "https://genapp.rocks/wiki/login/xmlrpc"


def load_env(path: Path = ENV_PATH) -> dict[str, str]:
    env = {
        "TRAC_BASE_URL": DEFAULT_BASE_URL,
        "TRAC_XMLRPC_URL": DEFAULT_XMLRPC_URL,
    }
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("TRAC_BASE_URL", "TRAC_XMLRPC_URL", "TRAC_USERNAME", "TRAC_PASSWORD"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def page_path(page: str) -> Path:
    safe_name = page.strip("/").replace("/", "__")
    if not safe_name:
        raise SystemExit("Page name cannot be empty")
    return PAGES_ROOT / f"{safe_name}.trac"


def page_url(base_url: str, page: str, *, format_txt: bool = False) -> str:
    base = base_url.rstrip("/")
    quoted_page = "/".join(urllib.parse.quote(part) for part in page.strip("/").split("/"))
    url = f"{base}/wiki/{quoted_page}"
    if format_txt:
        url = f"{url}?format=txt"
    return url


def xmlrpc_url_with_credentials(env: dict[str, str]) -> str:
    url = env.get("TRAC_XMLRPC_URL", DEFAULT_XMLRPC_URL)
    username = env.get("TRAC_USERNAME", "")
    password = env.get("TRAC_PASSWORD", "")
    parsed = urllib.parse.urlsplit(url)
    if parsed.username or not username or not password:
        return url

    userinfo = "{}:{}".format(
        urllib.parse.quote(username, safe=""),
        urllib.parse.quote(password, safe=""),
    )
    return urllib.parse.urlunsplit(
        (parsed.scheme, f"{userinfo}@{parsed.netloc}", parsed.path, parsed.query, parsed.fragment)
    )


def fetch_page(page: str, env: dict[str, str]) -> Path:
    url = page_url(env.get("TRAC_BASE_URL", DEFAULT_BASE_URL), page, format_txt=True)
    request = urllib.request.Request(url, headers={"User-Agent": "genapp-trac-wiki-mirror"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Fetch failed for {url}: HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Fetch failed for {url}: {exc.reason}") from exc

    PAGES_ROOT.mkdir(parents=True, exist_ok=True)
    output = page_path(page)
    output.write_text(content, encoding="utf-8")
    return output


def publish_page(page: str, env: dict[str, str], comment: str) -> None:
    path = page_path(page)
    if not path.exists():
        raise SystemExit(f"Missing local page source: {path}")

    url = xmlrpc_url_with_credentials(env)
    content = path.read_text(encoding="utf-8")
    attrs = {"comment": comment}
    try:
        server = xmlrpc.client.ServerProxy(url)
        ok = server.wiki.putPage(page, content, attrs)
    except xmlrpc.client.ProtocolError as exc:
        raise SystemExit(
            f"Publish failed: XML-RPC endpoint returned HTTP {exc.errcode} at {env.get('TRAC_XMLRPC_URL')}"
        ) from exc
    except xmlrpc.client.Fault as exc:
        raise SystemExit(f"Publish failed: XML-RPC fault {exc.faultCode}: {exc.faultString}") from exc
    except OSError as exc:
        raise SystemExit(f"Publish failed: {exc}") from exc

    if not ok:
        raise SystemExit("Publish failed: Trac returned false")


def status(env: dict[str, str]) -> int:
    base = env.get("TRAC_BASE_URL", DEFAULT_BASE_URL)
    xmlrpc = env.get("TRAC_XMLRPC_URL", DEFAULT_XMLRPC_URL)

    print(f"Base URL:    {base}")
    print(f"XML-RPC URL: {xmlrpc}")
    print(f"Env file:    {ENV_PATH} ({'present' if ENV_PATH.exists() else 'missing'})")
    print(f"Username:    {env.get('TRAC_USERNAME', '(unset)')}")

    request = urllib.request.Request(xmlrpc, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            print(f"XML-RPC HEAD: HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        print(f"XML-RPC HEAD: HTTP {exc.code}")
        return 1 if exc.code == 404 else 0
    except urllib.error.URLError as exc:
        print(f"XML-RPC HEAD: {exc.reason}")
        return 1
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch = subparsers.add_parser("fetch", help="Fetch a Trac wiki page into wiki_trac/pages")
    fetch.add_argument("page", help="Trac wiki page name, for example docs")

    publish = subparsers.add_parser("publish", help="Publish a mirrored page through XML-RPC")
    publish.add_argument("page", help="Trac wiki page name, for example docs")
    publish.add_argument("--comment", default="Update page from GenApp wiki mirror")

    subparsers.add_parser("status", help="Show Trac mirror configuration status")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    env = load_env()

    if args.command == "fetch":
        output = fetch_page(args.page, env)
        print(f"Fetched {args.page} -> {output}")
        return 0

    if args.command == "publish":
        publish_page(args.page, env, args.comment)
        print(f"Published {args.page}")
        return 0

    if args.command == "status":
        return status(env)

    raise AssertionError(f"Unhandled command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
