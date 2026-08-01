# Admin Test Scenarios (Phase 1)

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

Enable the feature only in a deployment's untracked `appconfig.json`:

```json
{ "test_scenarios": { "enabled": true } }
```

Deploy `test_scenarios/` beside that application configuration, outside the
public UI2 asset directory.  It is read by the protected endpoint, not fetched
as a public static file.

## Initial catalog shape

```json
{
  "schema_version": 1,
  "module_id": "data_interpolation",
  "scenarios": [
    {
      "id": "basic_documented_example",
      "label": "Basic documented example",
      "provenance": ["legacy_docs"],
      "maturity": "draft",
      "inputs": { "run_name": "interpolation_example" },
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

`id` values use letters, digits, `_`, and `-`; `inputs` is a JSON object.
Phase 1 accepts the provenance values `current_docs`, `legacy_docs`,
`gui_mimic`, `test_sassie`, `developer`, and `scientist`, and maturity values
`draft`, `candidate`, `verified_cli`, `verified_ui`, `release_ready`, and
`deferred`.

Scenario file staging is deliberately deferred.  A Phase 1 catalog may only
load normal, already-supported field values.  It may not contain executable
code, arbitrary paths, shell commands, or a browser-side file bypass.

## Verification stub

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
