# Responsive figure-title fitting shared gap (#333)

Owner approval: Joseph Curtis approved the shared-core extension and exact
17-file manifest on October 31, 2026, followed by approval of the generated
application Lab catalog as the 18th file. Targets are GenApp presentation and
the MCA view/Lab integration; paired SASSIE is read-only. Guardrail blobs before
this change: GenApp `585a1789795363fbf8e36654669717800ba65820`, application
`026640106438faa3812fe9094d59c6ba93470089`,
SASSIE `f094c6f2b1a4d00208ea588a08c5fd8fe4f803a4`. Governing plotting issue:
`ehb54/zazzie#184`; presentation rollout: `ehb54/zazzie#203`.

## Evidence and smallest application attempt

Application e5a501c deployed on core e80ce452 completed signed MCA job
7441e816-9f84-40a6-86f6-60c2f862e774 with eight figures. At a settled normal
gallery width of 487.875 CSS pixels, its first title measured 495.09375 pixels
with 9.09375 pixels of right overflow. Expanding the workspace to a 552.1875
pixel plot made it fit; restoring the normal gallery reproduced the defect.
The view already selects wide gallery layout and axis-title wrapping.

Core and Lab geometry chains fit legends, annotations, axes, subplots and tick
labels, but neither fits the main figure title. Axis wrapping selects only
xaxis/yaxis keys. A neutral long title produces no title update through that
existing helper. Existing metadata cannot request figure-title wrapping.
Stacking MCA figures would only hide the symptom at some widths; inserting
line breaks into producer titles or YAML would violate the presentation boundary.
No scientific values or shared driver capabilities are missing.

## Neutral reproduction and proposed contract

`t/fixtures/plotly_figure_title_overflow.html` uses generic measured/calculated
observations, a plain long title and a named annotation. At narrow widths the
non-opted control clips. The opted plot shares the same data and source layout.
The fixture exercises narrow/wide/restore, light/dark, zoom/reset, empty and
fresh replacement, annotation/toolbar/tick bounds and scale-2 PNG. The unit
contract is `t/unit_tests/plotly_figure_title_overflow.t`.

`plotPresentation.figureTitleOverflow: "wrap"` opts a group into shared,
measured, display-only wrapping and a centered container-relative top lane.
The helper preserves all title words, source outputs and hover policy. It
wraps plain titles at word boundaries; markup and unbreakable oversized words
are outside this bounded contract. Both UI2 renderers and the Lab reuse it.
Serialized geometry passes retain the latest request; exports/editor await the
pass. Annotation lanes follow title fitting. No module/output/scientific-name
branches are introduced. The detailed owner policy is in
`UI2-Core-Extension-Policy.md` and `Plotting-Architecture.md`.

## Compatibility and rollback

MCA is the opted-in consumer. The neutral no-selection fixture is the control.
Other view groups retain existing main-title behavior; missing/invalid settings
are ignored. No scientific data, original title, axis, uncertainty, output id,
YAML, hover precision/name policy, transport or saved file changes.
HTML5 remains unchanged. Removing the MCA opt-in and reconstructing from saved
output rolls the consumer back; reverting this coordinated extension removes
the generic capability. No saved-job migration is needed.

## Validation and acceptance

Record actual checks in `Plotting-Acceptance-Matrix.md`. Required local checks:
neutral fitting/lifecycle and source immutability, existing axis/tick/hover
regressions, target-filtered generation and legacy isolation, React type checks,
Lab catalog freshness and MCA fixture parity. Required deployed checks: normal,
expanded/restore and resize; signed and positive MCA; Lab light/dark with
matching/contrasting surfaces; title/axis/tick/legend separation; PNG and initial
editor; native fallback; completion, same/fresh-window and historical-result
reattachment; other MCA modes. Untested states remain pending. Lab authorization
failure observed on October 30 must be resolved through the normal access flow,
not bypassed. Susan's handoff remains conditional on complete acceptance.
