# Automatic logarithmic tick density (#333)

Owner approval: Joseph Curtis approved the coordinated correction manifest,
including gated GenApp core work, on October 26, 2026. No deployment is approved.

The application already selects concise `.4~g` notation. That changes text,
not automatic tick density. The existing tick-format browser fixture forces
`dtick: 1`, so it misses the failure. The new neutral fixture uses anonymous
scatter values over approximately 0.009–0.3, a logarithmic x axis and automatic
ticks. Before core changes, Plotly 2.35.2 in local headless Chrome produced six
adjacent overlapping label pairs at width 856 and zero at width 480. No module,
output, scientific role, or SASSIE-specific identifier enters the reproduction.

Existing view controls cover notation, title wrapping and subplot spacing,
not adjacent tick collisions. Producer tick placement would put responsive
presentation into saved scientific output. YAML does not own geometry.

Implemented contract: `plotPresentation.axisTickDensity` maps ordinary axis names
to `avoid-overlap`. Only explicitly declared log axes with automatic placement
participate. Measure native rendered labels, favor decade labels, and retain a
non-overlapping subset on detached display axes. Preserve explicit placement,
scientific arrays, ranges, zoom, formatting and hover precision. UI2 and the Lab
call one helper. Refit on rendering, resize and zoom; no module-specific logic.

Controls: omitted/invalid opt-in, linear/date/category axes, explicit axis or
template placement, and overlaid axes. Bounded fitting must not create relayout
loops. PNG and Chart Editor receive the fitted display layout. Saved outputs
retain native placement. Removing the opt-in restores automatic placement.

Local and Linux validation results are recorded below after implementation.
Live acceptance and deployment remain pending separate authorization.

## Local validation, October 26, 2026

- macOS Perl/Node lane: six suites passed, 763 assertions (`plotly_tick_density`,
  `plotly_tick_format`, `plotly_subplot_spacing`, `plotly_axis_title_overflow`,
  `plot_presentation_patterns`, `ui2_views`).
- Neutral local headless Chrome/Plotly 2.35.2 fixture: 33 checks passed. Covers
  widths 480/856/1200, repeated fitting, zoom/reset, source/range preservation,
  explicit placement, two panels, completed updates, purge/reconstruction,
  opt-in removal and scale-2 PNG export at displayed dimensions (1712x1116).
- Application regression lane: 101 tests passed, one known unrelated scenario
  catalog test excluded after reproducing its failure with the unchanged HEAD
  runner. The existing `tamc_phase6_charmm36_ssdna` result-view mapping does not
  cover each output id exactly once. Its catalog was not changed.
- All four MCA Decomposition fixtures rendered across four panel/canvas
  combinations (16 cases), with no adjacent q-label overlap. Color and grayscale
  component exports were reviewed: smaller filled measured markers and larger
  open rescaled markers remain distinguishable at coincident coordinates.
  Scientific fixture data/layout were preserved during presentation refresh.
- Linux runtime validation remains pending: the local Docker socket is absent.
  macOS checks are local evidence, not authoritative Linux runtime acceptance.
- Deployment, actual UI2/Lab lifecycle acceptance, Chart Editor interaction,
  and Susan's evaluation remain pending. No live service was changed.

The application commit also corrects acceptance-runner matrix hydration: it
reconstructs ordered rows from DOM cell coordinates and checks nested dimensions
and values instead of comparing a nested scenario matrix with a flat list.


## General collision protection (#334), October 27, 2026

Joseph Curtis approved the exact 14-file coordinated manifest and implementation,
scoped commit/push, Zazzie3 deployment, codex3 UI2/Lab acceptance and Susan handoff.
No scientific code or YAML publication is included. The earlier deployment-pending
notes above describe the October 26 local stage; #333's subsequent issue comment
records deployed acceptance at application 29fd0e6 and GenApp d6e634a.

Data Interpolation's concise .4~g tick notation cannot prevent spatial collision.
The previous helper required view opt-in and excluded every non-logarithmic axis.
This leaves the reported plot and other axis types unprotected. The neutral
fixture now reproduces label collisions without application/module identifiers,
then covers both axes, multiple dimensions/ranges, linear/log/date/category and
inferred/template/custom/reversed axes, subplots and overlays.

The generic contract is default fitting of all resolved Cartesian x/y labels.
Existing axisTickDensity consumers remain compatible; consumers without it now
receive the same protection. Explicit/custom text may be hidden when it collides,
but retained text and original grid positions remain unchanged. Source figures
remain authoritative. Rollback is a coordinated revert of #334 runtime/policy
changes, restoring #333's log-only opt-in behavior, not a producer workaround.

Validation and deployed acceptance results are recorded below.

### Local and Linux validation

- macOS: six focused Perl/Node suites passed, 763 assertions; target filtering,
  HTML5 assembly and the density suite passed another 52 assertions.
- Lab parity/export checks: 19 Python-driven Node tests passed.
- Headless Chrome/Plotly 2.35.2: 305 neutral browser checks passed, including
  event-driven zoom/resize, grid-position/text preservation, custom blank ticks,
  latest rapid zoom, overlays, subplots, PNG and displayed-layout reconstruction.
- Nine existing Data Interpolation/MCA fixtures passed at three widths (27
  cases), without rewriting their scientific payloads.
- Linux: four focused helper suites passed (11 harness assertions with nested
  Node assertions), using the existing Node 22.14.0 test runtime in zazzie3.
  No dependency installation or scientific runtime change was performed.
- UI2 fixture generation and HTML5 assembly passed. No generated HTML5 artifact
  drift remains.

### Deployed acceptance

October 27, 2026: passed on Zazzie3 UI2 with authorized administrator
account codex3. Deployed GenApp `bb7e6750`, application `5df5b6e`, and SASSIE
routing-only commit `2805a7e6a`.

- Data Interpolation scenario `data_interpolation_documented_automatic_31`:
  job `96622176-39d5-4582-934e-349995254ff3`; scientific verification passed.
- MCA scenario `multi_component_analysis_decomposition_exp_4_no_refine`:
  job `1e8269da-772d-45c8-87d3-f5b5ff8996d8`; scientific verification passed.
- Both passed normal, expanded/restore, zoom/pan/reset, completion,
  same-window and fresh-window reattachment, PNG and Chart Editor handoff.
  Independent rendered-label rectangle checks passed, including fresh-window
  plots. Source scientific values were unchanged.
- Additional live geometry/export checks passed: 15 Data Interpolation and
  14 MCA checks. The deployed Lab passed 111 checks across nine fixtures,
  light/dark themes and matched/contrasting canvases, with zoom/reset,
  PNG and Chart Editor scientific-series parity.
- Local and Linux validation is recorded in
  `UI2-Tick-Density-Shared-Gap-Report.md`. The canonical UI2 deployment wrapper
  passed readiness, generation, syntax/metadata and public-endpoint checks.
- codex3 was logged out after acceptance and the Lab was closed. No YAML was
  published and no Lab Recompile UI2 action was used.
