"""Application-specific checks for smoke-test.py: job runs in demo, tutorial2 and mulch.

A job submit returns {"_status":"started"}; util/jobrun.php then runs the executable and the page
polls ajax/get_results.php while it listens on the job's websocket topic. run_job() does the same.
"""

import json
import re
import time
import uuid

C = 299792458.0

PDB = """\
ATOM      1  N   ALA A   1      11.104   6.134  -6.504  1.00  0.00           N
ATOM      2  CA  ALA A   1      11.639   6.071  -5.147  1.00  0.00           C
ATOM      3  C   ALA A   1      13.164   6.010  -5.145  1.00  0.00           C
ATOM      4  O   ALA A   1      13.780   5.495  -6.080  1.00  0.00           O
ATOM      5  CB  ALA A   1      11.115   4.832  -4.425  1.00  0.00           C
END
"""


def run_job(site, wamp, menu, module, fields, files=None, timeout=120):
    job = str(uuid.uuid1())
    wamp.subscribe(job)
    time.sleep(0.5)
    code, j, text = site.submit(menu, module, fields, files=files, job_uuid=job)
    result = None
    if code == 200 and j is not None and j.get("_status") == "started":
        end = time.time() + timeout
        while time.time() < end:
            r = site.get("ajax/get_results.php", params={
                "_window": site.window, "_logon": site.logon, "_uuid": job, "_getlastmsg": 0, "_getinput": "false"})
            try:
                result = r.json()
            except ValueError:
                result = {"_raw": r.text[:300]}
            if result.get("_status") in ("complete", "failed", "cancelled") or "_raw" in result:
                break
            time.sleep(1)
    time.sleep(0.5)
    events = wamp.all(job)
    wamp.unsubscribe(job)
    return job, (text or "")[:200], result, events


def done(result):
    return result is not None and result.get("_status") == "complete" and "error" not in result


def short(result):
    return json.dumps(result)[:240] if result is not None else "no result"


def energy_ok(result, m):
    try:
        return abs(float(result["e"]) - m * C * C) <= 1e-9 * m * C * C
    except (KeyError, TypeError, ValueError):
        return False


def run(sites, wamp, check):
    demo, t2, mulch = sites["demo"], sites["tutorial2"], sites["mulch"]

    # demo: penergy is a python2 script that imports a module from the job directory
    _, sub, r, _ = run_job(demo, wamp, "simulate", "penergy", {"m": "2", "c": str(int(C))})
    check("demo: job simulate/penergy (python2), e = m c^2", done(r) and energy_ok(r, 2), short(r) if r else sub)

    # demo: create a project (users.project), list users as administrator, change the password (hash + verify)
    code, j, text = demo.ajax("ajax/sys_config/sys_user_config.php", {
        "_window": demo.window, "_logon": demo.logon,
        "newproject": "on", "newproject-newprojectname": "smokeproject", "newproject-newprojectdesc": "smoke test"})
    check("demo: sys_user_config.php creates project smokeproject", code == 200 and j is not None and "Adding project smokeproject" in j.get("status", ""), (text or "")[:200])
    _, sub, r, _ = run_job(demo, wamp, "admin", "sysuserslist", {"_docrootexecutable": "ajax/sys_config/sys_userslist.php"})
    report = (r or {}).get("sysuserreport", "")
    # columns: name, email, projects, last-login, registered, jobs-not-removed, running, admin
    row = re.search(r"<td>\s*smokeadmin\s*</td><td>.*?</td><td>\s*(\d+)\s*</td>", report)
    check("demo: admin job sysuserslist counts the user's project", done(r) and row is not None and row.group(1) == "1", report[-200:] if report else (short(r) if r else sub))
    newpw = demo.password + "-new"
    code, j, text = demo.ajax("ajax/sys_config/sys_user_config.php", {
        "_window": demo.window, "_logon": demo.logon, "changepassword": "on",
        "changepassword-password": demo.password, "changepassword-password1": newpw, "changepassword-password2": newpw})
    check("demo: sys_user_config.php changes the password", code == 200 and j is not None and "error" not in j, (text or "")[:200])
    fresh = type(demo)(demo.base.rsplit("/", 1)[0], demo.app)
    code, j, text = fresh.ajax("ajax/sys_config/sys_login.php", {"_window": fresh.window, "userid": demo.logon, "password": demo.password})
    old_refused = code == 200 and j is not None and j.get("_logon") != demo.logon
    code, j, text = fresh.ajax("ajax/sys_config/sys_login.php", {"_window": fresh.window, "userid": demo.logon, "password": newpw})
    check("demo: login refuses the old password and accepts the new one", old_refused and code == 200 and j is not None and j.get("_logon") == demo.logon, (text or "")[:200])

    # demo: registration captcha (imagick draws it, the answer goes to mongodb); a wrong answer is refused
    code, j, text = demo.ajax("ajax/sys_config/sys_captcha.php", {"_window": demo.window})
    png = (j or {}).get("captcha", "")
    check("demo: sys_captcha.php returns a png (imagick) and an id", code == 200 and png.startswith("iVBORw0KGgo") and (j or {}).get("id"), (text or "")[:120])
    if j and j.get("id"):
        code, j2, text = demo.ajax("ajax/sys_config/sys_captcha_verify.php", {"_window": demo.window, "id": j["id"], "captcha": "wrong!"})
        # a refusal is the empty result, [] in json
        check("demo: sys_captcha_verify.php refuses a wrong answer", code == 200 and (j2 == [] or (isinstance(j2, dict) and not j2.get("success"))), (text or "")[:160])

    # tutorial2: python2 job
    _, sub, r, _ = run_job(t2, wamp, "examples", "energy", {"m": "3", "c": str(int(C))})
    check("tutorial2: job examples/energy (python2), e = m c^2", done(r) and energy_ok(r, 3), short(r) if r else sub)

    # tutorial2: the job sends a udp message while running -> msg-udpserver -> zmq -> websocket
    job, sub, r, events = run_job(t2, wamp, "examples", "message", {})
    check("tutorial2: job examples/message result", done(r) and r.get("result") == "message sent 3 seconds ago", short(r) if r else sub)
    got = [e for e in events if isinstance(e, dict) and isinstance(e.get("_message"), dict)
           and e["_message"].get("text") == "Here is my message"]
    check("tutorial2: job's udp message reached the websocket subscriber", bool(got), json.dumps(events)[:240])

    # tutorial2: file upload with the job (perl executable echoes the uploaded file's path)
    job, sub, r, _ = run_job(t2, wamp, "examples", "pdbviewer", {},
                             files=[("inputpdb[]", ("smoke.pdb", PDB.encode(), "chemical/x-pdb"))])
    path = r.get("outputpdb") if r else None
    check("tutorial2: job examples/pdbviewer with an uploaded file", done(r) and isinstance(path, str) and path.endswith("smoke.pdb"), short(r) if r else sub)
    if isinstance(path, str):
        dl = t2.get(path)
        check("tutorial2: uploaded file served back from the results directory", dl.status_code == 200 and dl.text == PDB,
              f"GET {path} -> HTTP {dl.status_code}, {len(dl.text)} bytes")

    _, sub, r, _ = run_job(t2, wamp, "examples", "plotly", {})
    check("tutorial2: job examples/plotly (python2) returns plot data", done(r) and len(json.dumps(r)) > 200, short(r) if r else sub)

    # tutorial2: a job in a named project takes and releases the project lock (joblock collection)
    t2_job, sub, r, _ = run_job(t2, wamp, "examples", "energy", {"m": "1", "c": str(int(C)), "_project": "smokeproject"})
    check("tutorial2: job examples/energy in project smokeproject", done(r) and energy_ok(r, 1), short(r) if r else sub)

    # tutorial2: cancel a running job from the job manager (jobcancel: running collection, zmq message)
    job = str(uuid.uuid1())
    wamp.subscribe(job)
    time.sleep(0.5)
    code, j, text = t2.submit("examples", "message", {}, job_uuid=job)
    time.sleep(1)
    code, j, text = t2.ajax("ajax/sys_config/sys_job_manager.php",
                            {"_window": t2.window, "_logon": t2.logon, "action": "cancel", f"jqg_jobgrid_{job}": "on"})
    msgs = (j or {}).get("messages", "")
    check("tutorial2: job manager cancels a running job", code == 200 and j is not None and "error" not in j and job in msgs and "cancel" in msgs,
          (text or "")[:240])
    status = None
    end = time.time() + 30
    while time.time() < end:
        r = t2.get("ajax/get_results.php", params={"_window": t2.window, "_logon": t2.logon, "_uuid": job, "_getlastmsg": 0, "_getinput": "false"})
        try:
            status = r.json().get("_status")
        except ValueError:
            status = r.text[:100]
        if status in ("cancelled", "complete", "failed"):
            break
        time.sleep(1)
    check("tutorial2: cancelled job reports status cancelled", status == "cancelled", f"_status={status}")
    wamp.unsubscribe(job)

    # mulch: administrator reports run as jobs whose executable is a GenApp php script
    today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 86400))
    for module, docroot_exe, fields, key in (
            ("sysuserslist", "ajax/sys_config/sys_userslist.php", {}, "sysuserreport"),
            ("jobshistory_1", "util/jobs_history_web.php", {"input1": "2020-01-01", "input2": today}, "jobshisreport"),
            ("jobintegritycheck", "ajax/sys_config/sys_jobintegritycheck.php", {}, None)):
        fields = dict(fields, _docrootexecutable=docroot_exe)
        _, sub, r, _ = run_job(mulch, wamp, "admin", module, fields)
        ok = done(r) and (key is None or key in r)
        check(f"mulch: admin job {module} ({docroot_exe})", ok, short(r) if r else sub)

    # job and file bookkeeping that the pages poll (mongo reads through the adapter)
    for site, module, want in ((demo, "penergy", None), (t2, "energy", t2_job)):
        # root -> year-month -> day -> day:module -> jobs; the newest year-month and day are last
        nodes, key, ok = [], "#", True
        for depth in range(4):
            code, j, text = site.ajax("ajax/sys_config/sys_jobs.php", {"_window": site.window, "_logon": site.logon, "_tree": key})
            if code != 200 or not isinstance(j, list) or not j:
                ok = False
                break
            nodes = j
            if depth == 2:
                key = next((n["id"] for n in j if n["id"].endswith(":" + module)), None)
                ok = key is not None
                if not ok:
                    break
            else:
                key = j[-1]["id"]
        ids = [n.get("id") for n in nodes]
        ok = ok and all(n.get("data", {}).get("job") for n in nodes) and (want is None or want in ids)
        check(f"{site.app}: job tree sys_jobs.php down to the user's {module} jobs", ok, json.dumps(nodes)[:200])
        code, j, text = site.ajax("ajax/sys_config/sys_job_manager.php", {"_window": site.window, "_logon": site.logon, "action": "refresh"})
        check(f"{site.app}: job manager sys_job_manager.php refresh", code == 200 and j is not None and "error" not in j, (text or "")[:200])
        code, j, text = site.ajax("ajax/sys_config/sys_files.php", {"_window": site.window, "_logon": site.logon})
        check(f"{site.app}: file tree sys_files.php", code == 200 and text is not None and "error" not in (text or "")[:200], (text or "")[:200])

    code, j, text = t2.ajax("ajax/sys_config/sys_logoff.php", {"_window": t2.window, "_logon": t2.logon})
    check("tutorial2: logoff", code == 200 and j is not None and "error" not in j, (text or "")[:200])
