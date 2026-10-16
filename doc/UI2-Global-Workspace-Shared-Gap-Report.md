# UI2 global workspace shared-gap report

## Gap

UI2 exposes module navigation and fixed framework utilities, but it has no
application-neutral way for an opted-in application to advertise a durable,
project-wide workspace. Modeling such a workspace as a SASSIE module would
incorrectly bind it to one run form and would encourage application-specific
branches in the shared UI2 runtime.

## Shared contract

An application may declare `ui2_global_workspaces_url`. UI2 fetches that
same-origin JSON endpoint with the authenticated browser session. The endpoint
returns a bounded `workspaces` array containing stable `id`, short `label`,
same-origin `url`, and optional boolean `context_handoff` fields. Invalid or
unavailable entries are omitted. No directive means no UI change.

For an opted-in context handoff, UI2 writes one bounded record to
`sessionStorage` under a random, one-use token and navigates in the same tab.
The URL carries only the token and existing window identity. It does not carry
form values, project paths, credentials, or API keys. The destination owns
consumption and immediate deletion of the record.

## Boundaries

- The framework does not name or understand Analysis AI.
- The application endpoint owns authorization, labels, availability, and the
  destination implementation.
- Workspace results are not GenApp job outputs and do not alter ordinary run,
  plotting, event, or reattachment contracts.
- The manifest and destination must be same-origin. A missing, disabled, or
  unauthorized endpoint produces no control.
- Secrets remain server-side. The handoff is UI context, not an authority grant.

This is the minimum shared extension needed by the SASSIE Analysis AI workspace
without introducing a second module runner or an application-specific core
exception.
