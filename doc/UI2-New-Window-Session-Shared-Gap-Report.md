# UI2 New-Window Session Shared-Gap Report

Status: accepted for implementation with `ehb54/genapp#16`.

## Symptom and application-level boundary

An authenticated UI2 user selecting Job Manager **Attach in new window** reaches
a fresh browser window whose generated `window.name` has no matching PHP session
entry. UI2 therefore opens its mandatory login dialog before processing the
validated reattach target. Application views, module declarations, drivers, and
final-output contracts cannot establish a browser-window authentication binding.

## Neutral reproduction

In any UI2 application with a login-required module and Job Manager:

1. Log in and open Job Manager.
2. Select a job and choose **Attach in new window**.
3. UI2 opens a new context after an asynchronous server action.
4. The target context has a new `window.name`; status finds no authenticated
   entry for that identifier and requires login again.

The issue contains no SASSIE module name, scientific output, or application
view behavior.

## Generic contract

UI2 may request a same-origin, server-authorized handoff from one current
window id to one newly generated window id. The endpoint copies only the
authenticated application identity and project. It never copies credentials,
session tokens, arbitrary session data, or window-scoped preferences/settings.
The target page still obtains its session from the regular status endpoint.

## Consumers, compatibility, and rollback

The opted-in consumer is generic UI2 Job Manager new-window reattachment.
Same-window attachment and all HTML5 behavior remain unchanged. Other UI2
windows are non-opted-in controls. If handoff fails or the session has expired,
UI2 closes the placeholder window and reports the error; ordinary login remains
available. Rollback is removal of the UI2 handoff call and endpoint without
changing job records, drivers, module schemas, or final outputs.

## Required verification

Use a neutral generated UI2 fixture plus endpoint tests for valid, malformed,
and expired handoffs. Verify that target sessions omit window-local values;
verify same-window reattach, direct logged-out `_switch`, and HTML5 generation
remain unchanged.
