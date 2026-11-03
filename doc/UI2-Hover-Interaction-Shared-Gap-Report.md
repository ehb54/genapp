# Hover interaction diagnostics — #348/#349

Joseph Curtis approved the diagnostic plan and exact three-file manifest on
November 3, 2026. That initial approval covered the neutral fixture, its browser harness, and
this report. Joseph subsequently approved the ten-file #348 repair manifest
and instructed implementation on November 3, 2026. Commit, deployment and
authenticated browser acceptance remain outside that repair approval.

## Existing contracts and scope

Issues `ehb54/zazzie#348` and `#349` report missing closest-hover coordinates
and difficulty selecting overlapping marker/line traces. Plotting ownership
remains governed by `ehb54/zazzie#184`, `Plotting-Architecture.md` and
`UI2-Core-Extension-Policy.md`. Preserve #331 colors/grouping, #335 numeric
precision and #336 name suppression. SASSIE calculations and driver/helper
contracts have no demonstrated gap; no scientific changes are required.

The shared `plotly-layout.js` helpers are already consumed by ordinary UI2 and
the Plot Presentation Lab. Do not add module-specific hover behavior, change
scientific arrays/metadata/names, rewrite saved fixtures, split legend groups,
or add producer-side formatted strings.

Guardrail Git blob hashes inspected for this task:

- application AGENTS.md: `142e3e105f0082d47943fc49b63c442db7072d0c`
- SASSIE AGENTS.md: `f094c6f2b1a4d00208ea588a08c5fd8fe4f803a4`
- GenApp AGENTS.md: `ca871477b6466d4011b405837fe6380aa99a2e03`

## Neutral reproduction

`t/fixtures/plotly_hover_interaction.html` loads Plotly 2.35.2 and
the shared layout helper under test. `t/unit_tests/plotly_hover_interaction.t`
launches isolated unauthenticated Chrome through Python Playwright. It uses
real mouse movement, including selection of the coordinates hidden by the
production collision fitter. No trace is forced through `Fx.hover`.

Formatting controls vary linear/log axes, marker/line traces, numeric precision
and name suppression. Selection controls vary size 6/11 and trace order,
compare mode and spatial separation. Every pointer sample checks scientific
source immutability. #348 is now a required passing assertion; the separate #349 selection issue
remains TODO. Broken controls, missing evidence and source changes are hard failures.

Run with explicit executables:

```sh
GENAPP_HOVER_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
GENAPP_HOVER_PYTHON="$HOME/anaconda3/bin/python" \
prove -v t/unit_tests/plotly_hover_interaction.t
```

An optional `GENAPP_HOVER_REPORT` path retains the full JSON observations
outside the repository. This is diagnostic evidence, not a runtime dependency.

## Findings and repair boundary

Before browser execution, source inspection showed that `tickDensityUpdate`
uses invisible tick text to suppress colliding labels. Plotly's array-tick
formatter returns matching `ticktext` before consulting numeric hover formats.
An in-memory execution of that vendor branch produced an invisible label at
valid coordinate 0.035 with `.6g`, on both linear and log axes. This establishes
a formatting-path hazard; the browser fixture must establish its rendered
consequences and controls before choosing a repair.

Closest hover is a single-target selection mode. The renderer currently uses
Plotly's selection without a separate overlap-inspection helper. A failure to
select both coincident traces must be distinguished from a general broken
line-hover path; compare mode and separated-line controls provide that check.
Changing colors, names, grouped legends or scientific coordinates is excluded.

## Local browser evidence — November 3, 2026

Core baseline: `f003eee706615169203b8065df8b8f17e190e3f7`, branch
`php7designer`. The final harness ran isolated HeadlessChrome 156.0.0.0 with
Plotly 2.35.2. All 215 control/source checks passed. The six Perl assertions
include two failing TODO assertions for the still-unrepaired desired behaviors;
these are observed defects, not successful repair acceptance. Syntax and the
scope guard also passed. No application, SASSIE, runtime or deployed files
were changed. The full local JSON is `/private/tmp/hover-348-349-diagnostics.json`.

### #348: collision masking supplies the blank hover coordinate

At 511 CSS pixels, the unmodified production fitter masked source point 0.030
on a linear axis and 0.031 on a logarithmic axis. Real pointer events still
reported the correct numeric x coordinate. Rendered marker hover became
`x: <invisible>`, with the expected `y: 0.808 ± 0.010`; line hover became
`(<invisible>, 0.808093)` or its corresponding next-point value.

All four linear/log × marker/line cases lost x with collision fitting enabled.
The same source coordinates remained visible with fitting disabled. The result
persisted with no numeric opt-in, `.6g`, and `uncertainty-2`, and with names
suppressed or unsuppressed. Source arrays/uncertainty/identity were unchanged.
Therefore neither uncertainty rounding nor curve-name suppression causes the
missing coordinate. An axis hover-format setting is the smallest applicable
formatting attempt and does not bypass Plotly's array-tick lookup.

This is a demonstrated shared integration gap: the collision mask belongs to
presentation geometry but leaks into native hover formatting. It also affects
calculated curves without error bars. A repair limited to uncertainty templates
would leave that case broken. No application view/driver workaround is proposed.

### #349: native closest selection depends on geometry, size and trace order

The neutral pair shares a legend group and uses the unchanged native
`togglegroup` action. Seven real pointer positions were sampled around the line
vertex, at sizes 6/11, in both orders, with exact coincidence and a 0.0001 y
separation (subpixel at the tested geometry). Closest mode selected only the
marker in three of the four size-6 cases. Both curves were sampled in the
remaining size-6 case and in all four size-11 cases. This is bounded pointer
sampling, not proof that no other pointer location could ever reach the line.

Compare mode exposed both original traces in all eight cases without names.
A separated-line control was selected directly in closest mode. Thus line hover
is operational; overlap competition is the problem. Smaller markers alone do
not establish #349 acceptance. The diagnostic includes a near-overlap failure
in the same marker-first/line-second order used by the application.

The next decision is whether the existing compare control is an acceptable
inspection workflow, or a new generic overlap-inspection interaction is needed.
Do not silently prioritize one scientific role, change names/colors/groups,
reorder scientific traces, or infer application semantics in core. A new
interaction requires its own design and exact manifest; no runtime change for
#349 is approved or proposed in this diagnostic phase.

## Approved repair manifest: #348 only

Repair the shared separation between fitted tick display and numeric hover
formatting. Retain collision protection, original tick/grid positions, authored
formats, precision/uncertainty behavior, compare shared-x behavior, and original
saved figures. First establish the repair in the neutral real-pointer fixture,
then verify consumers through their existing shared helper path. Do not edit
Plotly's vendored bundle or add module-specific branches.

The exact proposed follow-up write manifest is:

GenApp (`../genapp`):

- `languages/ui2/add/js/plotly-layout.js` — shared correction; preserve the
  existing caller API and lifecycle.
- `t/fixtures/plotly_hover_interaction.html` — extend the reproduction into
  repair acceptance, including explicit formats and reconstruction.
- `t/unit_tests/plotly_hover_interaction.t` — make #348 a required pass;
  retain #349 observations separately.
- `t/unit_tests/plotly_tick_density.t` — protect native ticks/grid positions,
  collision fitting, restoration and teardown.
- `t/unit_tests/plotly_numeric_hover.t` — protect numeric-format precedence,
  uncertainty precision and unaffected consumers.
- `doc/UI2-Hover-Interaction-Shared-Gap-Report.md` — implementation, rollback
  and verification evidence.
- `doc/Plotting-Architecture.md` — clarify that fitter-authored suppression
  must not replace numeric hover values.
- `doc/UI2-Core-Extension-Policy.md` — state the same generic compatibility
  invariant at the core gate.
- `doc/Plotting-Acceptance-Matrix.md` — distinguish local and deployed evidence.

Application (`../genapp_zazzie`):

- `docs/plot_presentation.md` — route the confirmed #348 defect and acceptance
  to the shared owner without changing application presentation selections.

References remain read-only: application drivers, module/view definitions,
presentation YAML/registry, Lab scripts/catalog/fixtures, and all SASSIE code.
Core `ui2.js`, React/generated assets, vendor Plotly, directives, #347 and #349
runtime behavior are excluded. If the correction cannot preserve the existing
helper API/callers within this manifest, stop and revise the plan before editing.

There is no new schema, opt-in, transport or runner: restore the existing
contract for the collision-fitted consumer and preserve non-fitted controls.
Rollback reverts the scoped correction and reconstructs from unchanged saved
output. Joseph approved this manifest and replacement of the diagnostic scope on
November 3, 2026. It authorizes the listed local implementation and verification
only; no caller or #349 interaction expansion is authorized.


## Required repair acceptance

Preserve explicit formats and unresolved-coordinate compatibility, uncertainty
rounding/trailing zeros, compare shared-coordinate presentation, names and
legend behavior. Exercise ordinary native/React UI2, Lab and initial Chart
Editor handoff, closest/compare modes, signed/positive profiles and Guinier,
light/dark and contrasting surfaces, normal/expanded/restore, resize,
zoom/pan/reset, updates where applicable, completion and fresh-window
reattachment. Verify nonoverlapping axis labels and unchanged source payloads.
Local neutral diagnostics do not establish deployed MCA acceptance. Application
commit e77dce7 for #345/#346 remains a separate pending publication.

## Implemented correction

The existing `applyTickDensity` lifecycle now repairs the hover presentation
only for values masked by its own linear/log tick patch in closest mode. It
reuses Plotly's numeric template formatting rather than adding a numeric engine.
Explicit trace/axis formats and tick-format stops retain precedence. Authored
array-tick labels, intentional blank labels, template units, names, error text,
scientific values and source figures remain intact. Default native name clipping
is retained when an implicit hover acquires a display template.

The native placeholder is retained after the corrected coordinate, carrying
native error-bar text even without the uncertainty opt-in. The precision helper
recognizes the preceding source template, so changes to values/errors refresh
its normal precision strings. Widening, mode changes and replacement restore
or rebuild the display patch. The existing internal-event guard covers restyles
as well as relayouts. No new caller API, schema, producer identity, vendor change,
transport, file, or scientific/replay store is introduced.

Initial editor handoff includes the already prepared hover templates with the
fitted layout, so it needs no additional UI2 callback. PNG uses the same fitted
axis labels at scale two. Normal saved-output reconstruction starts again from
the unchanged scientific figure.

Final local test results are recorded below. Deployed MCA,
ordinary UI2/Lab surface matrices and authenticated reattachment remain pending.

### Final local repair verification — November 3, 2026

- The isolated real-pointer harness passed 325 control/source checks and all
  required #348 assertions. Only the independently scoped #349 selection
  assertion remains a failing TODO. Detailed JSON:
  `/private/tmp/hover-348-repair.json`.
- The same new fixture/harness against the committed `f003eee7` layout helper
  fails the required `coordinate visible linear markers` assertion, establishing
  that the regression check detects the original defect.
- Nine focused core suites passed 25 Perl assertions, with six optional legacy
  browser assertions skipped. The new Playwright acceptance above actually ran.
  Suites cover numeric hover, tick density/notation, hover names/identity,
  axis-title clearance, figure-title fitting, subplot spacing and legends.
- Application styling and Lab/Plotly parity checks passed 33 pytest tests.
- Real pointer acceptance covers linear/log marker/line cases; authored
  axis/trace/template formats and format stops; authored labels and intentional
  blanks; x/y native errors; scattergl and bar; unmasked points; default name
  clipping and application name suppression; 511/620/855 CSS-pixel widths;
  zoom/reset; precision refresh after an existing value changes; reconstruction;
  clear/repopulate; closest/compare transitions; a 1022×960 PNG; and initial
  displayed-figure editor transfer without a UI2 callback.
- Source arrays, uncertainties, names, metadata and legend groups remained
  unchanged except for the explicit neutral value-update test. Fitted tick
  positions/restoration and newer authored template precedence passed unit
  controls. Fitted cases retained collision-free Cartesian tick labels.

These are local neutral and application parity results. No server was contacted,
no authenticated account was used, and no live scientific job was submitted.
Deployed MCA positive/signed/Guinier, ordinary native/React UI2 and Lab surface
matrices, completion and same/fresh-window reattachment remain pending. No
commit, push, publication, UI2 regeneration or Susan handoff occurred for #348.
