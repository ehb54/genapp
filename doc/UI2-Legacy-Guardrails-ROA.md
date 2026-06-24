# UI2 Legacy Guardrails ROA

UI2 is a GenApp target, not a separate application model. The normal GenApp
contract remains one application definition compiled to every requested target
language. Target-filtered generation is a development and deployment
convenience; it is not the architectural safety boundary.

## Shared Changes That Require Legacy Coverage

- Optional `views/` metadata is shared generator behavior. It must stay inert
  for legacy targets unless a legacy template explicitly consumes view tokens.
- Target-specific `module_overrides/` is shared generator behavior. It is
  intentional, but target overrides must be reviewed as target behavior changes.
- `--language` and `--languages` are filtered generation helpers. Default
  generation must still compile every language listed in `directives.json`.
- Languages without field type templates, such as `ui2`, may skip type-template
  file checks. Template-driven targets such as `html5` must still check them.
- Repeater validation is shared schema behavior. Avoid adding special repeat
  forms for a transient application workaround.

## Checkbox False Repeat Decision

The temporary support for `repeat: "checkbox_id:false"` was removed after the
Zazzie application switched the affected PDBRx inputs to cleaner checkbox gates.
No active Zazzie module uses checkbox false-qualified repeats. A negative
validation test now rejects this pattern so it does not become accidental global
schema surface area.

If GenApp intentionally adopts false-qualified checkbox repeats later, that
should be a deliberate schema decision with tests for `html5`, `ui2`, and
repeater reports.

## Current Guardrail Tests

- `t/unit_tests/html5_language_overrides.t`
  - proves inert view files do not change legacy HTML5 generation
  - covers target-specific module replacement behavior
- `t/unit_tests/language_filter.t`
  - proves default generation builds all directive languages
  - proves `--language` filters generation only when requested
- `t/unit_tests/negative_validation_contracts.t`
  - rejects malformed repeat expressions, including checkbox false-qualified
    repeats
- `t/unit_tests/high_risk_repeater_reports.t`
  - covers listbox option repeats, nested checkbox repeaters, and integerpair
    repeaters
- `t/unit_tests/high_risk_feature_compile.t`
  - exercises HTML5 generated repeaters, file/path inputs, dynamic outputs,
    progress, transport helpers, and generated runtime wiring

## Operational Rule

When UI2 work touches shared GenApp code or shared app JSON, treat it as a
legacy-risk change. Add or run a legacy-facing test before deployment.
