# Admin Test Scenarios

## Purpose

An optional application-owned scenario catalog helps an administrator prepare a
module for rapid end-product testing.  It is not a replacement for
`test_sassie`: it joins documented examples, GUI behavior, and `gui_mimic`
inputs at the UI2 boundary.

UI2 core owns catalog retrieval, authorization-aware availability, form
hydration, and result verification.  React/shadcn is the primary presentation
inside UI2 and calls those core actions through the bridge.  Native UI2 renders
the same actions as its fallback/reference implementation.  HTML5 is not given
this workflow.

## Catalog location and lifecycle

An application may add `test_scenarios/<module-id>.json`.  No catalog means no
test-scenario control and changes nothing for ordinary users or modules.

The generated UI2 endpoint returns a catalog only when both conditions hold:

1. `appconfig.json` enables `test_scenarios.enabled`.
2. The current server session belongs to `appconfig.restricted.admin`.

The browser's claimed user name is checked against the PHP session; it does not
grant access.  Catalogs are never bundled into the public UI2 app map.

Enable the feature only in the deployment-specific `appconfig.json` (tracked or
untracked according to that application's deployment policy):

```json
{ "test_scenarios": { "enabled": true } }
```

Deploy `test_scenarios/` beside that application configuration, outside the
generated `output/` tree and public UI2 asset directory. It is read by the
protected endpoint, not fetched as a public static file. The generated endpoint
is installed at `output/ui2/ajax/ui2_test_scenarios.php`, and the browser resolves
catalog and asset requests relative to the UI2 target rather than through the
legacy application-root AJAX route. The endpoint uses `output/ui2/modules/` only
to validate declared field identities and types; it never looks for private
catalogs or assets under `output/`.

## Catalog shape

```json
{
  "schema_version": 2,
  "catalog_revision": "2026-08-28.1",
  "module_id": "data_interpolation",
  "scenarios": [
    {
      "id": "basic_documented_example",
      "label": "Basic documented example",
      "provenance": ["legacy_docs"],
      "maturity": "draft",
      "expected_outcome": "job_completed",
      "inputs": { "run_name": "interpolation_example" },
      "files": {
        "experimental_data": {
          "asset_id": "documented_input",
          "filename": "example.dat",
          "size": 1234,
          "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        }
      },
      "verification": {
        "schema_version": 1,
        "checks": [
          { "id": "completed", "kind": "job_status", "equals": "complete" },
          { "id": "report", "kind": "output_present", "output_id": "interpolated_file" }
        ]
      }
    }
  ]
}
```

Schema 2 adds `catalog_revision`, ordered repeated files, and
`expected_outcome`. Schema 1 catalogs and their single-file declarations remain
supported. A schema 2 revision is a stable application-owned token using
letters, digits, `.`, `_`, and `-`; change it whenever scenario identity or
assets change.

`id` values use letters, digits, `_`, and `-`; `inputs` is a JSON object.
Phase 1 accepts the provenance values `current_docs`, `legacy_docs`,
`gui_mimic`, `test_sassie`, `developer`, and `scientist`, and maturity values
`draft`, `candidate`, `verified_cli`, `verified_ui`, `release_ready`, and
`deferred`.

`inputs` contains ordinary declared field values. File inputs use the optional
`files` map instead; an `inputs` entry must not encode a local or server path.
Each file declaration targets a module field of type `file` or `lrfile` and
contains only a logical asset id, safe display filename, byte size, and SHA-256.
For a repeated `file` or `lrfile` field, schema 2 uses an array in row order:

```json
"files": {
  "trajectory_file": [
    { "asset_id": "pair", "filename": "first.dcd", "size": 123, "sha256": "...64 lowercase hex..." },
    { "asset_id": "pair", "filename": "second.dcd", "size": 456, "sha256": "...64 lowercase hex..." }
  ]
}
```

Array position is the zero-based repeated row identity used internally; the
first declaration is attached to the first live picker, the second to the
second, and so on. Arrays are rejected for non-repeated fields. This keeps file
selection ordered without exposing paths or selector code.

Assets use this private application-owned layout:

```text
test_scenarios/assets/<module-id>/<asset-id>/<filename>
```

They are never copied into the public UI2 asset map. The same administrator-
protected endpoint that returns the catalog resolves a declaration under this
fixed root, checks real-path containment, enforces a 16 MiB per-file limit, and
checks size and SHA-256 before returning bytes. The browser fetches and verifies
every declared file before changing the form, retains it as a core-owned file
selection, and mirrors it into the native file input when the browser permits.
Ordinary multipart submission appends that verified selection when no manual
local or server file choice replaces it. Catalogs cannot contain executable
code, arbitrary paths, shell commands, or server-file selections.

When a scenario is selected, UI2 stores its id and catalog revision as reserved
job-input metadata. Reattachment uses that metadata before the legacy
ordinary-value inference path. A persisted revision that differs from the
current catalog is not silently matched to another scenario. These reserved
values do not alter module inputs or scientific execution.

Loading a scenario never submits it. After any dirty-input confirmation, UI2
first obtains all declared files. It then resets ordinary inputs to the module's
declared defaults, applies the scenario values, and attaches the verified files.
This prevents omitted fields or a prior local/server file selection from leaking
into a later scenario. Native UI2 and the React workbench call the same runtime
operation and report file failures without submitting a job.

## Verification stub

Schema 2 scenarios declare one safe `expected_outcome`: `load_only`,
`validation_rejected`, `job_completed`, or `job_failed`. UI2 can report a
successful load-only case, a browser validation rejection, and completed versus
failed terminal job status without running catalog-provided code. Application
or browser-lane work may supply the event that proves an expected rejection;
the catalog remains declarative.

The verifier reads final durable output after completion and again when a job
is reattached.  Its initial allowlist is intentionally small:

* `job_status` with an `equals` value;
* `output_present` with an `output_id`;
* `output_nonempty` with an `output_id`.

The verifier reports `not_run`, `running`, `passed`, `failed`, or
`unsupported`.  It does not manufacture output or change scientific results.
Scientific numerical tolerances, artifact inspection, and domain-specific
checks require a later reviewed extension; they must not be supplied as
arbitrary scenario scripts.

## Curation workflow

For each real module, record the source of each scenario and promote it only
after the corresponding CLI (`gui_mimic`) and UI2 evidence exists.  Legacy
folder-based examples that conflict with the current HDF5 contract remain
explicit `deferred` scenarios until the documentation and module behavior are
reconciled.
