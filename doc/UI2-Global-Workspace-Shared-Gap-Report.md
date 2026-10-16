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

## Project lifecycle refresh

The application-level workspace manifest can legitimately depend on the
authenticated project. UI2 originally fetched it during session refresh only.
After the existing project-selection and project-creation handlers updated the
active project locally, workspace availability therefore remained stale until
a full page reload. The application endpoint could not repair that lifecycle
gap because shared UI2 owns the top-bar controls and manifest fetch.

After a successful project selection or creation, UI2 now refetches the same
optional manifest after updating session identity. The behavior remains fully
generic: the runtime does not name an application or workspace and does
nothing when `ui2_global_workspaces_url` is absent. A failed or unavailable
manifest retains the existing empty-control behavior. Rollback is removal of
the two post-project-change refetches; ordinary project state and module/job
contracts are otherwise unchanged. The application owner approved this exact
shared-core lifecycle change as part of the Analysis AI issue 499 implementation
manifest on 2026-10-16.
