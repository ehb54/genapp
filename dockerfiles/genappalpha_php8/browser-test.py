#!/usr/bin/env python3
"""Browser check of a genappalpha-php8 test container with headless Chromium (Playwright), run by browser-test.sh.

The generated tutorial2 page's own javascript does the work: autobahn (WAMP v1) over /ws2 to msg-wsserver,
the register and login forms, and two modules. Checks that the websocket delivers the job's message and
that the results appear on the page. Writes screenshots to OUTDIR.
usage: browser-test.py [BASEURL [OUTDIR]]
"""

import json
import sys
import time
import uuid

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1/tutorial2/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/out"
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""), flush=True)


def wait_for(page, cond, timeout=30):
    # page.wait_for_timeout, not time.sleep: the sync api only dispatches events (websocket frames) inside its calls
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        page.wait_for_timeout(250)
    return False


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 1000})
    console, frames = [], []
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("websocket", lambda ws: ws.on("framereceived", lambda f: frames.append(f if isinstance(f, str) else f.decode(errors="replace"))))

    page.goto(BASE)
    # ws.js colours the footer's "ws" green once the autobahn session (WAMP v1, /ws2 -> msg-wsserver) is open
    session = wait_for(page, lambda: page.evaluate(
        "() => !!$('#_state').data('_wssession') && getComputedStyle(document.querySelector('.wsstatus')).color === 'rgb(0, 128, 0)'"))
    check("page's autobahn session to msg-wsserver open (ws status green)", session, str(page.evaluate("() => $('#_state').data('_ws')")))
    page.screenshot(path=f"{OUT}/1-loaded.png")

    # tutorial2 shows no register link; register over http from the page's own context, log in with the form
    user = "browser" + uuid.uuid4().hex[:6]
    password = "browser-" + uuid.uuid4().hex[:10]
    r = page.request.post(BASE + "ajax/sys_config/sys_register.php", form={
        "_window": page.evaluate("() => window.name"), "userid": user, "email": f"{user}@example.org",
        "password1": password, "password2": password})
    check("register (http)", r.ok and "successfully added" in r.text(), r.text()[:160])

    page.click("#login")
    page.wait_for_selector("#sys_login #password")
    page.fill("#sys_login #userid", user)
    page.fill("#sys_login #password", password)
    page.click("#sys_login_submit")
    logged_in = wait_for(page, lambda: page.evaluate("() => $('#_state').data('_logon')") == user, 20)
    check("login form, page state _logon set", logged_in, str(page.evaluate("() => $('#_state').data('_logon')")))

    page.click("li#examples")
    page.click("#examples_message")
    page.wait_for_selector("#message_submit")
    before = len(frames)
    page.click("#message_submit")
    got_msg = wait_for(page, lambda: any("Here is my message" in f for f in frames[before:]), 30)
    check("Messaging Exercise: the job's udp message reaches the page over the websocket", got_msg,
          next((f[:160] for f in frames[before:] if "Here is my message" in f), "no frame"))
    shown = wait_for(page, lambda: "Here is my message" in page.inner_text("#configbody3"), 10)
    check("Messaging Exercise: the message box shows it", shown)
    result = wait_for(page, lambda: page.locator("#message_output #result").input_value() == "message sent 3 seconds ago", 30)
    check("Messaging Exercise: job result shown", result, page.locator("#message_output #result").input_value())
    page.screenshot(path=f"{OUT}/2-message.png")
    page.click("#closeModal3")

    # the sidebar has collapsed; the menu's module buttons stay at the top of the panel
    page.click("#examples_energy")
    page.wait_for_selector("#energy_submit")
    page.fill("#energy #m", "2")
    page.click("#energy_submit")
    energy = wait_for(page, lambda: page.locator("#energy_output #e").input_value().replace(".", "").startswith("179751035747363"), 30)
    check("Energy: e = m c^2 for m = 2 shown", energy, page.locator("#energy_output #e").input_value())
    page.screenshot(path=f"{OUT}/3-energy.png")

    errors = [c for c in console if c.startswith(("pageerror", "error"))]
    check("no javascript errors", not errors, "; ".join(errors)[:300])
    with open(f"{OUT}/console.txt", "w") as f:
        f.write("\n".join(console) + "\n")
    with open(f"{OUT}/ws-frames.txt", "w") as f:
        f.write("\n".join(frames) + "\n")
    browser.close()

failed = [n for n, ok in RESULTS if not ok]
print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
sys.exit(1 if failed else 0)
