# Shared hover-name suppression gap — #336

## Neutral reproduction and approved boundary

Issue https://github.com/ehb54/zazzie/issues/336 requests no curve names in
hover labels for all existing and future SASSIE-web plots. The existing
`prepareHoverNameDisplay` only supports the view-level `full` default and
preserves explicit producer settings. A neutral scatter figure with a name,
`hoverinfo: "x+y+name"`, per-point name lengths and an authored
`<extra>curve name</extra>` reproduces three independent name channels.
A default `namelength: 0` cannot override explicit trace/template settings or
empty an authored extra box. No scientific values or transport are missing.
The owner approved the generic shared-core plan and exact manifest in the
#336 chat on October 27, 2026, including application precedence over `full`.

## Solution

Application directive `ui2_plotly_hover_name_display: "none"`; one generic,
immutable preparation helper used by ordinary UI2 and the application Lab.
No module ids, scientific roles, name matching, permanent exceptions, producer
changes, YAML changes or saved-output rewrites. Missing/invalid directive
values preserve the old native/full-name contract. See Plotting-Architecture
and UI2-Core-Extension-Policy for detailed precedence and content boundaries.

## Evidence

Local validation is complete; deployed acceptance remains pending.
Focused tests extend `t/unit_tests/plotly_hover_names.t` and its real Plotly
fixture with neutral explicit/template/array cases, controls, immutability,
repeat preparation and saved-figure reconstruction. The application parity suite
checks that UI2 and the Lab use the same helper and directives selection.
Local evidence (October 27, 2026):

- Real Chrome/Plotly 2.35.2: 109 checks passed, including native/full controls,
  explicit/templates/per-point settings, closest/compare/unified, light/dark,
  expand/restore, append/update/completion/reconstruction, 3D resolved settings
  and heatmap templates. 3D pointer hover still requires deployed inspection.
- Application Lab parity: 21 tests passed, including preservation of every
  captured fixture's non-hover fields and immutable saved-figure reconstruction.
- Seven passing Perl suites provided 812 harness assertions: hover names/colors,
  numeric precision, tick collision fitting, target filtering, view generation
  and HTML5 assembly. JavaScript syntax and application directive checks passed;
  tracked `ga.min.js` remained clean.
- Linux Node 22.14.0: three focused helper suites passed (10 harness assertions,
  nested Node assertions; browser subtests explicitly skipped).
- The broader `t/unit_tests/ui2_runtime_logic.t` fails its existing strict
  object-identity assertion `non-opted-in UI2 preserves its original display
  path`. The same assertion fails with unmodified HEAD `677b225d` UI2/layout
  sources loaded through an isolated Node preload; #335 already clones the
  display figure unconditionally. #336 preserves that baseline. The out-of-scope
  runtime test was not changed; its failure is not claimed as a pass.

Deployed UI2/Lab acceptance remains required.
