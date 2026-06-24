# UI2 Shared Change Review ROA

This review covers non-`languages/ui2/*` changes made during the UI2 prototype
work. UI2 is a normal GenApp target, not a separate application model, so shared
generator behavior must remain safe for legacy targets such as `html5`.

## Summary

The UI2 prototype added one large target-local surface (`languages/ui2/*`) and a
small number of shared GenApp changes. The target-local work does not directly
affect legacy output. The shared changes do affect GenApp semantics and need
legacy-facing tests.

Current status: the risky temporary `checkbox:false` repeat support has been
removed. The remaining shared changes are either target selection helpers,
optional metadata plumbing, or guardrail tooling.

## Shared Changes

### Optional Views Metadata

- Files: `bin/genapp_run.pl`, `etc/perl/genapp_util.pl`
- Behavior: adds optional `views/<module>.json` and
  `<language>/views/<module>.json` loading for targets/templates that request
  `__viewjson__` or `__viewjson_raw__`.
- Decision: keep.
- Legacy risk: low if legacy templates do not consume view tokens.
- Coverage:
  - `t/unit_tests/html5_language_overrides.t` proves inert view files do not
    alter generated `html5` module HTML/PHP.
  - `t/unit_tests/ui2_views.t` proves UI2 receives merged view metadata.

### Module Overrides

- Files: `etc/perl/genapp_util.pl`
- Behavior: adds `<language>/module_overrides/<module>.json` as a preferred
  target-specific module replacement path, before the older
  `<language>/modules/<module>.json` fallback.
- Decision: keep.
- Legacy risk: medium. This is intentionally shared target behavior; a
  misplaced `html5/module_overrides` file would change HTML5.
- Coverage:
  - `t/unit_tests/ui2_views.t` covers UI2 override precedence.
  - `t/unit_tests/html5_language_overrides.t` covers legacy language module
    replacement behavior.
- Follow-up: document `module_overrides` in the GenApp target override docs
  before broader adoption.

### Target-Filtered Generation

- Files: `bin/genapp_run.pl`, `etc/perl/genapp_util.pl`,
  `tools/zazzie3_update_genapp_core.sh`
- Behavior: adds `genapp --language LANG` and `--languages LIST` to compile
  selected directive languages. Default generation still compiles every
  language listed in `directives.json`.
- Decision: keep.
- Legacy risk: low when understood correctly. This is a developer/deploy helper,
  not a replacement for the normal all-target GenApp compile model.
- Coverage:
  - `t/unit_tests/language_filter.t` proves default generation builds both
    `html5` and `ui2`, while explicit filters build only the requested target.

### Compiled Language Reporting

- Files: `bin/genapp_run.pl`
- Behavior: prints the compiled language list at the end of a successful run.
- Decision: keep.
- Legacy risk: low. Output text changes only.
- Coverage:
  - indirectly exercised by generation tests.

### Field Type Template Skipping

- Files: `etc/perl/genapp_util.pl`
- Behavior: languages that do not reference `__fields:type__` in their language
  definition skip type template existence checks. This allows renderer-style
  targets such as UI2 to carry module JSON without one template per field type.
- Decision: keep.
- Legacy risk: low for template-driven targets because `html5` still uses field
  type templates and still checks them.
- Coverage:
  - `t/unit_tests/ui2_views.t` proves UI2 can carry known GenApp field types
    without type templates.
  - `t/unit_tests/high_risk_feature_compile.t` still exercises HTML5 field type
    generation.

### Checkbox False-Qualified Repeats

- Files: formerly `etc/perl/genapp_util.pl` and high-risk repeater fixture.
- Behavior: temporary support allowed `repeat: "checkbox_id:false"`.
- Decision: remove.
- Reason: the pattern came from a transitional PDBRx workaround. The Zazzie app
  now uses cleaner checkbox gates, and active Zazzie modules no longer use this
  repeat form.
- Coverage:
  - `t/unit_tests/negative_validation_contracts.t` now rejects
    `checkbox:false` repeats.
  - `t/unit_tests/high_risk_repeater_reports.t` continues to cover listbox
    option repeats, nested checkbox repeaters, and integerpair repeaters.

## Current Guardrail Commands

Run these before deploying a UI2 change that touches shared GenApp code or
shared app JSON:

```sh
prove -v t/unit_tests/html5_language_overrides.t
prove -v t/unit_tests/language_filter.t
prove -v t/unit_tests/negative_validation_contracts.t
prove -v t/unit_tests/high_risk_repeater_reports.t
prove -v t/unit_tests/high_risk_feature_compile.t
prove -v t/unit_tests/high_risk_feature_matrix.t
```

For Zazzie3 app directives:

```sh
tools/check_zazzie3_directives.sh
```

## ROA

The remaining shared GenApp changes are acceptable for continued UI2 work, but
they are no longer "UI2-only" in the architectural sense. They are GenApp
features and must be reviewed as such.

The next UI2 milestone should reuse the existing GenApp runtime/job contract:
module JSON, generated frontend, submit/job manager, `bin/` driver, SASSIE
backend, progress, and dynamic outputs. Bypassing the `bin/` drivers should not
be the next experiment unless we deliberately choose to design a second runtime
contract.
