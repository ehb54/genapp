# UI2 Unauthenticated Authentication Overlay Shared-Gap Report

Status: approved for implementation by the repository owner on 2026-09-17.

## Symptom and application-level boundary

When a generated UI2 application is logged out, its splash, mandatory Login,
and Register dialogs use the ordinary translucent dialog backdrop. The
application shell therefore remains visible behind authentication controls.
SASSIE-web demonstrates the problem, but the backdrop and dialog lifecycle are
owned by generic UI2 core.

An application-owned stylesheet override would duplicate the UI2 session gate
and require each application to track which generic dialogs are mandatory
authentication surfaces. SASSIE-web has no such override today, and adding one
would fork shared presentation behavior instead of fixing its owner.

## Application-neutral reproduction

Generate any UI2 fixture that uses the ordinary legacy Login and Register
modules, open it without an authenticated session, and observe these paths:

1. the initial splash over the generated application shell;
2. the mandatory Login dialog opened from the splash; and
3. the Register utility dialog opened from the splash.

The generic `.ui2-dialog-overlay` background is translucent in every case.
The same initial splash is also used by applications that opt into an external
authentication provider manifest.

## Existing contracts cannot express the behavior

Application views organize declared module fields and outputs. Module JSON and
authentication provider manifests declare authentication choices and backend
policy. None of those contracts owns the UI2 shell backdrop or whether an
already-mounted application is visually exposed while the session is logged
out. Adding an application directive for this invariant would make a required
session-gate presentation rule optional.

## Generic UI2 behavior

UI2 marks mandatory Login and Register overlays with an internal generic
authentication-overlay class. The initial splash already has a stable splash
class. Those logged-out surfaces use the current theme's opaque UI2 background,
fully obscuring the mounted application shell. No new application schema,
module metadata, backend request, or authentication protocol is introduced.

## Compatibility, control, and rollback

The affected consumer is every generated UI2 application while logged out.
The non-affected control is an ordinary dialog opened after authentication;
those dialogs retain the existing translucent backdrop. External-only provider
splashes receive the same opaque session gate without changing provider data,
warning text, navigation, or authorization.

The change is presentation-only and limited to UI2. HTML5 output, session
state, Login and Register endpoints, application modules, submitted values,
and completed-job behavior are unchanged. Rollback consists of removing the
internal authentication-overlay class assignments and their opaque CSS rule.

No existing GenApp or SASSIE GitHub issue governs this focused presentation
change. The repository owner's instruction to carry out the reviewed plan is
the explicit approval for the shared-core change.
