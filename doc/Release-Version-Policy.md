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
