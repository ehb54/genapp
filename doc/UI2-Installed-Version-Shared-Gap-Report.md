# Installed version tracking: demonstrated shared gap

The application needs Version details to reflect verified installed artifacts
after an ordinary build/deployment, including copied applications without Git.
An application-only change cannot control UI2's manifest precedence, its cached
fetch, or the identity of the generator that actually ran.

## Evidence and approval

The read-only neutral reproduction used component `fixture_app`, an embedded
schema-1 revision of forty `a` characters and a fetched manifest revision of
forty `b` characters. Before this change `normalizeReleaseManifest` returned
the embedded revision. `loadReleaseManifest` also retained one Promise for the
whole page, so a later deployment could not update an already-open browser.
No scientific module, plot, driver, screenshot or deployment assumption is
needed to reproduce either gap.

The user approved the simpler tracking plan and exact 33-file coordinated
manifest, including the generator, generic utility, UI2 runtime, tests and
policies here. This authorizes these shared changes only; deployment, live hook
cleanup, YAML publication and UI2 Lab recompilation were not requested.

## Small shared change

Reuse the existing release-manifest URL and schema 1. An explicit root
`installed_tracking: 1` opts in. The application declares its application and
generator IDs and owns component ordering. A successful generation emits a
portable receipt for its application and actual generator, bound to hashes of
generated files; no separate runner, service or version API is introduced.
Copied sources use build receipts. Unknown evidence stays unknown.

Keep installed identity separate from release identity. The served instance
manifest is updated only by the application's verified atomic publisher.
Regeneration preserves it. UI2 fetches on every panel opening, replaces the
previous list, reports unavailable on failure, and uses the fetched installed
revision even when embedded metadata is stale. The generic contract accepts
recorded, modified, mixed and not-recorded states without interpreting component
science, deployment topology or compatibility.

## Verification and compatibility

`t/version_metadata.t` checks actual generator identity and copied-source
receipts. `t/unit_tests/language_filter.t` checks neutral opted/non-opted
fixtures, one-target generation, artifact receipts, preserved installed stacks
and failure propagation. `t/unit_tests/ui2_runtime_logic.t` executes neutral
precedence, release/installed separation, unknown and mixed states, repeated
panel fetching, replaced lists and unavailable states. Existing HTML5 and
non-opted UI2 controls remain. No authenticated browser acceptance or production
deployment is claimed by these local checks.

## Fallback and rollback

A missing or invalid public manifest cannot prevent the application from
running. Failed generation cannot replace the prior successful receipt or
publish a new installed stack; its previous receipt's hashes will reject
partially changed generated files. Missing package stamps remain not recorded.
Restore a prior verified artifact with its receipt and publish after verification
for a deployment rollback. Removing the opt-in returns an application to legacy
revision display; it does not make checkout metadata authoritative evidence of
what was installed. Do not seed unknown deployments or change containers to
make a version display look complete.
