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


## Tick retention correction (#347), November 3, 2026

Joseph Curtis approved the exact nine-file #347 manifest and local implementation
in this chat on November 3, 2026. Commit, deployment and authenticated browser
acceptance are outside that approval. Baselines: GenApp `cc4e647a`, application
`b61dace`. Governing architecture: `ehb54/zazzie#184`; issue #347 owns the defect.

Guardrail Git blobs: application AGENTS.md
`142e3e105f0082d47943fc49b63c442db7072d0c`; SASSIE AGENTS.md
`f094c6f2b1a4d00208ea588a08c5fd8fe4f803a4`; GenApp AGENTS.md
`ca871477b6466d4011b405837fe6380aa99a2e03`.

### Demonstrated shared gap before runtime changes

Read-only local rendering of the existing MCA profile payloads reproduced the
single `0.3` label at 511 pixels. No fixture, scientific array, module/view or
YAML was changed. The reduced anonymous case uses automatic logarithmic ticks,
`.4~g`, x values `[0,.01,.02,.03,.05,.08,.1,.2,.3]`, ordinary scatter values and
a linear response axis. At 620 pixels, the renderer supplies 13 nonblank native
x labels. Rectangle fitting selects eight, but the unchanged helper retains
only `0.3`. The new browser regression fails with
`fitted scale retains multiple labels 620 linear` before any runtime edits.
The initial simpler `.005`-minimum control retained its scale; it does not
reproduce this case. Reports: `/private/tmp/tick347-before.json`.

Exact equality is used both for DOM/native tick coordinates and for numeric
keys between fitting passes. Logarithmic conversions can change low floating-
point bits. A label selected by geometry can consequently lose correspondence
and become blank. Existing tests only require no collisions and unchanged text
among survivors, so excessive suppression passes them. Notation/view settings
cannot repair this internal identity loss. Manually forcing producer ticks or
pixel geometry would violate the ownership contract.

### Approved generic correction and controls

Match tick identity within its own axis using exact correspondence first, then
one-to-one nearest matching within a few machine-precision units. Cap tolerance
by neighboring tick separation so distinct nearby authored ticks are not merged.
Keep the original renderer-supplied tick values exactly; do not round values or
replace geometry selection. Preserve monotonic visibility within a fitting pass
and restore eligible labels on a fresh fit. No schema, opt-in, caller API,
scientific output, vendor code or module-specific branch is added.

SASSIE work and a driver/helper scientific change are unnecessary: all values
already exist. Reuse the existing generic helper, UI2/Lab geometry lifecycle,
normal final output and reconstruction. Non-fitted controls, category/date and
custom/blank/reversed/secondary axes, exact grid values, repeated fitting,
zoom/pan/reset/resize, PNG/editor and #348 hover behavior must remain covered.
No module migration or deployed acceptance is inferred. If the neutral browser
reproduction does not respond to this correction, stop and reassess the cause
within the approved scope before expanding implementation.


### Implemented correction and local verification

The shared helper reserves exact matches before approximate correspondence.
Approximate numeric matches use an eight-machine-epsilon bound, reduced to at
most a quarter of the closest distinct neighbor separation. Every candidate is
used at most once. Both DOM/native coordinate selection and subsequent-pass
label carry-forward use the same correspondence. The original tick values are
retained without rounding; visibility remains monotonic within one fitting
pass. Existing fresh-fit restoration, title clearance, event handling, source
ownership and #348 hover preparation remain in place. No caller or presentation
selection changed.

- Neutral Chrome/Plotly 2.35.2: 421 rendered checks passed. The old helper fails
  the useful-scale assertion at 620 pixels; corrected scenes retain multiple
  labels on linear/log response plots at 511/620/855 pixels. Repeated fits,
  zoom/pan/reset, resize/restore, exact native tick values, source/range/text
  preservation, date/category/custom/blank/reversed axes, subplots/overlays,
  PNG and initial displayed-layout editor reconstruction passed.
- The new unit regression exercises differing native/DOM low bits, a second
  array-mode fitting pass and nearby distinct authored ticks. The committed
  baseline fails before completing that second pass because labels are lost;
  the correction passes with unchanged original grid values.
- #348 real-pointer regression: all 325 control/source checks passed. Expected
  explicit formats now derive from the point actually selected, so the test
  does not assume which tick geometry will mask. Only #349 remains a failing
  TODO; overlap selection is unchanged and independently scoped.
- Nine focused core suites passed, reporting 27 assertions with eight optional
  browser assertions skipped. The tick fixture and #348 browser acceptance above
  actually ran. Application styling/Lab parity passed 33 pytest tests.
- The same 18 read-only MCA profile cases used during investigation now retain
  7/9/10 x labels at 511/620/855 pixels respectively. This covers experimental/
  rescaled and rescaled/calculated signed primary/companion and positive payloads
  through the shared layout helpers; it does not establish live UI2/Lab acceptance.
- The scale-2 retained-scale PNG was visually reviewed: labels and axis titles
  are readable and unclipped. Artifacts: `/private/tmp/tick347-after.json`,
  `/private/tmp/tick347-after.png`, `/private/tmp/tick347-mca-after.json`, and
  `/private/tmp/tick347-hover-regression.json`. These are local evidence, not
  runtime dependencies.

Deployed native/React UI2 and Lab theme/surface matrices, normal/expanded/
restore, actual browser/container resize, completion, same/fresh-window
reattachment, PNG and initial Chart Editor handoff remain pending. Existing
#333 acceptance limitations are not certified by this correction. No commit,
push, deployment, YAML publication, UI2 generation or authenticated account use
occurred for #347 during this implementation phase.
