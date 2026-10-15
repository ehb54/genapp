# GenApp Release Version Policy

`VERSION` owns the GenApp framework version. It uses SemVer-compatible
prerelease spelling; the current development value is `0.1.0-beta.1`, displayed
as `GenApp 0.1.0 Beta 1`.

GenApp generation records the application version from `directives.json`, the
GenApp version from `VERSION`, and Git source revisions when the corresponding
checkout is a Git work tree. Existing Subversion revision display remains a
fallback for historical applications. Generated checkout metadata describes
the deployment and does not turn a development version into a published
release.

An application can set `ui2_release_manifest_url` to opt into a same-origin
JSON manifest. UI2 accepts schema version 1 with a `components` array. Every
accepted component has:

- `component_id`: stable machine identifier.
- `version`: canonical component version.
- `display_version`: human-readable component and version.
- `release_stage`: `alpha`, `beta`, `rc`, or `final`.
- `release_date`: original GitHub publication date in UTC `YYYY-MM-DD` form.
- `source_revision`: full release commit when known.
- `tag_name`: immutable release tag.
- `release_url`: canonical GitHub release URL.

UI2 renders the records in the splash page's Version details panel. Missing or
invalid optional manifests do not block the application. URLs must resolve to
the generated application's origin. UI2 labels records without a publication
date as unreleased and does not invent dates, tags, URLs, or compatibility.

Each application repository owns its manifest and component ordering. SASSIE
and SASSIE-web rules live in their paired repositories. A compatibility matrix
is a separate reviewed artifact; equality of independent versions does not
imply compatibility.

To publish a GenApp release, update and validate `VERSION`, commit the release
state, create the immutable mapped tag, publish the GitHub release, and record
the original publication date and URL in consuming application manifests.
Changing `VERSION` alone does not publish a release.

## Installed build tracking (explicit opt-in)

A schema-1 manifest may declare `installed_tracking: 1`, `application_component`
and `generator_component` IDs present in its component list. For that language,
GenApp emits `output/<language>/build-info.json` after successful generation.
The receipt records application and actual generator build stamps and hashes
of generated artifacts. Stamps contain schema version 1, component ID, version,
full revision or null, tracked-source modified boolean, UTC build time and scope
(`application` or `generator`). A copied source root may carry these stamps in
`.local/build-info.json`; without Git or a receipt its revision is unknown.
The generator's version always comes from its own `VERSION`. Source changes
across generation, invalid receipts and opted-in post-command failures stop
successful receipt creation. The application owns deployment verification and
publication; a receipt alone is not a deployment claim.

The served manifest's per-component `installed` value is null or an object:
`version`, `revision` (full hash or null), `status` (`recorded`, `modified`,
`mixed`, `not_recorded`), `parts` (scope-to-build-stamp map), and `verified_at`.
Publication preserves the component's release fields and other components.
A generator must preserve an already-served opted-in manifest on regeneration;
only the application's verified atomic publisher updates the instance stack.
An intentional release-template update must likewise preserve installed records.

UI2 fetches the same-origin manifest without cache on every Version details
opening. For opted-in records, installed information comes only from that
manifest, including unknown and mixed states; embedded checkout metadata may
not override it. Failed reads show unavailable, not a previous stack presented
as current. Release source revisions, dates and tags retain their meaning.
Applications without the opt-in retain their existing source-metadata overlay;
HTML5 behavior and existing directive/template contracts remain supported.
Old `.local/source_revision_metadata.json` is not loaded for installed-tracking
applications. There is no framework dependency on SASSIE, Docker or host paths.

See [the neutral shared-gap report](UI2-Installed-Version-Shared-Gap-Report.md)
for evidence, scope, compatibility controls and rollback. The application owns
scientific interpreter selection, component selection and deployment ordering.


## Automatic application-owned completion

Applications should integrate verified installed-record publication into their
normal install/deploy commands so operators do not need a separate publication
step. This remains an application deployment responsibility. GenApp's generic
generation receipt is build evidence; the existing verified deployment wrapper
decides when it becomes the instance's installed record. Bare generation must
not claim that scientific packages were installed.

For SASSIE-web, the supported scientific owner installers notify the existing
application atomic writer after their checks. A one-time, machine-local binding
connects the scientific Python prefix to its exact publisher/instance manifest.
The owner contract is `../genapp_zazzie/docs/source_revision_metadata.md`.
Standalone scientific environments need no website. Completion updates only the
verified component and requires an exact installed/build-stamp match. Failed
recording fails the command and distinguishes successful installation from
unsuccessful bookkeeping. UI2's manifest schema and fresh reads are unchanged;
there is no new framework callback, SASSIE dependency, service or version API.
