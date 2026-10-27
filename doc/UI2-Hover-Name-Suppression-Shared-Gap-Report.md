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

Local and deployed #336 acceptance is complete; the separately characterized
baseline runtime assertion remains unresolved.
Focused tests extend `t/unit_tests/plotly_hover_names.t` and its real Plotly
fixture with neutral explicit/template/array cases, controls, immutability,
repeat preparation and saved-figure reconstruction. The application parity suite
checks that UI2 and the Lab use the same helper and directives selection.
Local evidence (October 27, 2026):

- Real Chrome/Plotly 2.35.2: 109 checks passed, including native/full controls,
  explicit/templates/per-point settings, closest/compare/unified, light/dark,
  expand/restore, append/update/completion/reconstruction, 3D resolved settings
  and heatmap templates. Deployed 3D pointer inspection is recorded below.
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

Deployed UI2/Lab acceptance is recorded below.

### Deployed acceptance — October 27, 2026

Passed on Zazzie3 UI2 with task-authorized administrator account `codex3`.
Deployed GenApp `3b0c3231a01ed7853dc1f6a69c8297d170ffca21` and application
`e0799f583dd3`; SASSIE routing-only commit `efaf1fce6` is pushed and requires
no scientific installation. The canonical UI2 wrapper passed readiness, core
fast-forward, generation, 144 handler syntax checks, 55 metadata decodes, public
endpoint verification and installed-version publication. The standard Lab
static-asset publisher deployed the updated preview JavaScript separately.
No YAML was edited/published and no Lab Recompile UI2 action was used.

- Fresh project: `issue336_hover_20261027`. The initial attempt in the existing
  project was refused by its running-job lock. That lock was left untouched;
  the new project was created through normal UI controls.
- Data Interpolation `data_interpolation_documented_automatic_31`, job
  `bd016cd1-76aa-45d1-9d30-f9e5c9be361b`: scientific verification, completion,
  same-window and fresh-window reattachment passed.
- MCA `multi_component_analysis_decomposition_exp_4_no_refine`, job
  `831cd987-f1ff-4d97-bdef-934558184f44`: scientific verification, completion,
  same-window and fresh-window reattachment passed.
- Deployed UI2: 46 checks passed across both modules' plot result tabs, including
  normal/fresh-window rendering, 1100/1600 widths, expanded/restore, zoom/reset,
  scientific arrays/uncertainty/name preservation, visible values without hover
  names, nonoverlapping Cartesian tick labels, PNG and initial Chart Editor
  handoff. Additional closest/x/y/unified checks passed for both modules,
  with actual rendered values, plus normal pointer pan/reset and collision checks.
- Pre-#336 saved Data Interpolation job `53ba443b-30e6-43e7-b657-84230473edcc`
  passed normal Job Manager **Attach in new window**. Hover names were absent;
  original scientific data, uncertainty, names and source payload were unchanged.
- Lab: 64 cases across 16 fixtures and light/dark × matched/contrasting canvases
  passed. Coverage included Data Interpolation, all seven MCA fixture lanes,
  Extract Utilities dynamic spatial/profile/residual plots, TAMC explicit-name
  templates/scattering previews and SAS Assembly heatmaps. Native names stayed
  hidden, scientific arrays/uncertainty/names remained intact and Cartesian
  labels did not collide.
- Actual pointer hovers passed for Extract Utilities WebGL 3D and SAS Assembly
  heatmaps on all four theme/surface combinations (eight cases). Coordinates,
  values and point details such as `selected source frame 6` remained visible;
  curve names did not. Lab PNG and initial editor handoff also passed.
- Neutral Chrome fixture: 109 checks passed. All 102 captured Lab figures across
  25 modules preserved non-hover fields in the application regression test.
  Final deployed Linux Node 22.14.0 helper suites passed all 10 harness assertions.

The two new scenario runs build their figures at completion; a deployed live
append phase is inapplicable to those cases. Bounded append/update, explicit
producer/template/per-point settings and saved reconstruction are exercised by
the neutral real-Plotly fixture. No new long simulation, failed scientific run,
or empty scientific result was fabricated for this display-only change.
The existing broad runtime test failure described above remains a separately
characterized baseline failure, not a reported pass or a #336 regression.

All temporary acceptance/editor windows were logged out/closed; the Lab tab was
closed. Main `codex3` logout was confirmed through the visible UI2 splash.
Raw check reports and screenshots are retained locally under
`/private/tmp/issue336-results/`; this temporary path is supporting evidence,
not an application dependency. Existing unrelated work and staging were preserved.
