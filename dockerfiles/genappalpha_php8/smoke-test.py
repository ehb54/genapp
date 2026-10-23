#!/usr/bin/env python3
"""Protocol-level smoke test of a genappalpha-php8 test container (run by smoke-test.sh).

Talks to the container the way the generated pages do: HTTP to Apache (ajax/*.php), WAMP v1 over
the /ws2 websocket proxy to msg-wsserver.php, and raw UDP/TCP messages to msg-udpserver.php and
msg-tcpserver. Needs python3 with requests and websocket-client; prints one line per check and
exits non-zero if any check fails.
"""

import argparse
import json
import socket
import sys
import threading
import time
import uuid

import requests
import websocket

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""), flush=True)
    return ok


class Wamp:
    """Minimal WAMP v1 client (what autobahn 0.8 does in the browser): subscribe and collect events."""

    def __init__(self, url):
        self.ws = websocket.create_connection(url, subprotocols=["wamp"], timeout=10)
        self.welcome = json.loads(self.ws.recv())
        self.events = []
        self.lock = threading.Lock()
        self.ws.settimeout(1)
        self.running = True
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()

    def _reader(self):
        while self.running:
            try:
                msg = self.ws.recv()
            except websocket.WebSocketTimeoutException:
                continue
            except Exception:
                break
            try:
                data = json.loads(msg)
            except ValueError:
                continue
            if isinstance(data, list) and data and data[0] == 8:
                with self.lock:
                    self.events.append((data[1], data[2]))

    def subscribe(self, topic):
        self.ws.send(json.dumps([5, topic]))

    def unsubscribe(self, topic):
        self.ws.send(json.dumps([6, topic]))

    def wait(self, topic, pred=lambda e: True, timeout=20):
        end = time.time() + timeout
        while time.time() < end:
            with self.lock:
                for t, e in self.events:
                    if t == topic and pred(e):
                        return e
            time.sleep(0.2)
        return None

    def all(self, topic):
        with self.lock:
            return [e for t, e in self.events if t == topic]

    def close(self):
        self.running = False
        try:
            self.ws.close()
        except Exception:
            pass


class Site:
    """One application: a requests session (PHP session cookie) and the browser-side _window/_logon state."""

    def __init__(self, base, app):
        self.base = f"{base}/{app}"
        self.app = app
        self.s = requests.Session()
        self.window = "smoke" + uuid.uuid4().hex[:8]
        self.logon = ""

    def get(self, path, **kw):
        return self.s.get(f"{self.base}/{path}", timeout=60, **kw)

    def post(self, path, data, files=None):
        return self.s.post(f"{self.base}/{path}", data=data, files=files, timeout=300)

    def ajax(self, path, data, files=None):
        r = self.post(path, data, files)
        try:
            return r.status_code, r.json(), r.text
        except ValueError:
            return r.status_code, None, r.text

    def submit(self, menu, module, fields, files=None, job_uuid=None):
        data = dict(fields)
        data.update({"_window": self.window, "_logon": self.logon, "_project": "", "_uuid": job_uuid or str(uuid.uuid1())})
        return self.ajax(f"ajax/{menu}/{module}.php", data, files)


def page_checks(site):
    r = site.get("")
    check(f"{site.app}: GET / (index.html)", r.status_code == 200 and "<html" in r.text.lower(), f"HTTP {r.status_code}, {len(r.text)} bytes")
    r = site.get("ajax/sys_uid.php")
    try:
        j = r.json()
    except ValueError:
        j = {}
    check(f"{site.app}: GET ajax/sys_uid.php", r.status_code == 200 and "_ws" in j, f"_ws={j.get('_ws')}")


def register_login(site, user, password):
    code, j, text = site.ajax("ajax/sys_config/sys_register.php", {
        "_window": site.window, "userid": user, "email": f"{user}@example.org",
        "password1": password, "password2": password})
    check(f"{site.app}: register {user}", code == 200 and j is not None and "error" not in j, (text or "")[:200])
    code, j, text = site.ajax("ajax/sys_config/sys_login.php", {
        "_window": site.window, "userid": user, "password": password})
    ok = code == 200 and j is not None and j.get("_logon") == user
    check(f"{site.app}: login {user}", ok, (text or "")[:200])
    if ok:
        site.logon = user
        site.password = password
    return ok


def relay_checks(wamp, udpport, tcpport):
    topic = str(uuid.uuid1())
    wamp.subscribe(topic)
    time.sleep(1)
    payload = {"_uuid": topic, "_textarea": "udp smoke message\n"}
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as u:
        u.sendto(json.dumps(payload).encode(), ("127.0.0.1", udpport))
    e = wamp.wait(topic, lambda e: "udp smoke" in json.dumps(e))
    check("udp -> msg-udpserver -> zmq -> msg-wsserver -> websocket", e is not None, json.dumps(e)[:200] if e else "no event")

    topic = str(uuid.uuid1())
    wamp.subscribe(topic)
    time.sleep(1)
    reply = b""
    with socket.create_connection(("127.0.0.1", tcpport), timeout=10) as t:
        t.sendall((json.dumps({"_uuid": topic, "_textarea": "tcp smoke message\n"}) + "\n").encode())
        try:
            while True:
                chunk = t.recv(4096)
                if not chunk:
                    break
                reply += chunk
        except socket.timeout:
            pass
    check("tcp -> msg-tcpserver reply", b"message forwarded" in reply, reply.decode(errors="replace")[:200])
    e = wamp.wait(topic, lambda e: "tcp smoke" in json.dumps(e))
    check("tcp -> msg-tcpserver -> zmq -> msg-wsserver -> websocket", e is not None, json.dumps(e)[:200] if e else "no event")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1")
    ap.add_argument("--ws", default="ws://127.0.0.1/ws2")
    ap.add_argument("--udpport", type=int, default=30779)
    ap.add_argument("--tcpport", type=int, default=30780)
    ap.add_argument("--keepalive", type=int, default=35, help="seconds to wait for a keepalive event (0 skips)")
    args = ap.parse_args()

    try:
        wamp = Wamp(args.ws)
        check("websocket /ws2 (apache proxy) WAMP welcome", wamp.welcome and wamp.welcome[0] == 0, json.dumps(wamp.welcome))
    except Exception as ex:
        check("websocket /ws2 (apache proxy) WAMP welcome", False, repr(ex))
        return 1

    sites = {app: Site(args.base, app) for app in ("demo", "tutorial2", "mulch")}
    for site in sites.values():
        page_checks(site)

    # smokeadmin is the applications' administrator (restricted.admin in the test image's appconfig.json)
    password = "smoke-" + uuid.uuid4().hex[:12]
    for site in sites.values():
        register_login(site, "smokeadmin", password)

    import smoke_modules  # application-specific job submissions (smoke_modules.py)
    smoke_modules.run(sites, wamp, check)

    relay_checks(wamp, args.udpport, args.tcpport)

    if args.keepalive:
        wamp.subscribe("keepalive")
        e = wamp.wait("keepalive", timeout=args.keepalive)
        check("msg-keepalive -> websocket keepalive event", e is not None, json.dumps(e) if e else "none")

    wamp.close()
    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
