# Complete narrow legend allocation (#351)

November 5, 2026. Governing plotting contract: ehb54/zazzie#184.

## Scope and approval

The owner approved the exact twelve-file plan and manifest, explicitly including
GenApp core changes, and requested implementation, guarded commit/push, normal
Zazzie3 UI2 deployment, targeted codex3 acceptance and Susan handoff after passing.
Other plotting-module audits and presentation polishing are excluded. No SASSIE,
scientific driver, module/view, YAML, fixture-source or saved-job changes are needed.

Pre-edit guardrail blobs (application, SASSIE, GenApp):
`633687810637f86eb39fff84376dc0e228acd901`,
`f094c6f2b1a4d00208ea588a08c5fd8fe4f803a4`,
`2ded7332b83d25ef818f7f2351157c95a7f43bbb`.

## Symptom and neutral evidence

MCA Decomposition Guinier has eight entries in four contrast groups. Narrow UI2
requires legend scrolling and the Lab scale-2 PNG loses the final two entries.
Widening restores them. The existing application view already uses the standard
UI2 legend policy. View/YAML sizing or shortening/grouping away entries would
work around shared allocation and violate the requested preservation of names,
identities and ordinary PNG behavior. No new application metadata is necessary.

`t/fixtures/plotly_legend_overflow.html` reproduces the failure with eight neutral
sample traces in four groups at a 550-pixel browser viewport (488-pixel figure).
It uses production legend functions, the existing presentation geometry queue,
allocation observer, and camera hook. Plotly 2.35.2 caps an inside legend at the
data-area height even when yref is container. The old fitter measures that capped
viewport; expanding the bottom margin reduces the data area and makes the cap
smaller. Camera export retains the figure size and therefore the same clipping.
The baseline helper fails the required entry-bounds assertion at Sample 2 measured.
Both reported symptoms have this common allocation cause in the neutral case.

## Correction and compatibility

`GenAppPlotlyLayout.legendFitUpdate` uses complete renderer legend content height
in logical figure pixels, rather than only the clipped scroll viewport. If that
content exceeds the remaining data-area height, the existing reserved bottom lane
uses negative paper y coordinates with top anchoring. This selects Plotly's
outside-plot legend allowance. Paper x anchoring avoids a spurious side margin
when Plotly combines container x and outside-paper y. The figure and PNG remain
at their existing dimensions; scientific data are not compressed or rewritten.

Ordinary UI2 and the Lab call this same helper. Their old fitter remains only as
compatibility fallback if the shared helper is unavailable. Short legends retain
the prior container placement; a no-legend figure returns no allocation update.
No schema, capability token, producer key or module-specific branch is added.
The existing UI2 legend policy is the consumer; short/no-legend neutral cases are
controls. Legends exceeding Plotly's half-figure outside allowance or supported
coordinate range retain existing scrolling rather than forcing unbounded growth.
This correction is not a promise to display arbitrarily many entries in any box.

Trace order, names, metadata, units, axes, arrays, uncertainty, legend groups,
colors, markers, completion and normal saved-output reconstruction stay intact.
Rollback restores the three production JavaScript changes and republishes through
the established UI2/Lab workflow; saved jobs require no migration or rollback.

## Local validation

- Neutral real-Plotly regression: twelve rendered cases, light/dark surfaces,
  550/1050/550 viewport transitions, reconstruction, six scale-2 camera exports,
  short/no-legend and two-slot controls. All entry text is checked against both
  image and legend viewport bounds. Axis/title containment and collision checks,
  source/identity parity and PNG dimensions pass. Narrow PNG visually reviewed.
- Application UI2/Lab parity: 21 tests passed, including complete-content versus
  clipped-viewport allocation and unchanged source layouts.
- Focused existing core suites: 764 assertions passed (views, native geometry,
  axis-title clearance, legend identity and tick fitting). The optional older
  hover browser suite was skipped because its browser variable was unset.
- JavaScript syntax and diff whitespace checks passed. Browser checks ran in
  local Chrome on macOS. No Linux Node runtime was available on the inspected
  Zazzie host/container; these are not claimed as Linux runtime results.

## Deployment acceptance

Pending deployment and targeted codex3 browser checks. Use the existing completed
MCA job and corresponding Lab Guinier fixture only, at narrow and normal widths,
light/dark surfaces, widen/restore, PNG, and saved-result reconstruction. Include
ordinary UI2 and native fallback. Retain readable axes/title and all eight entries.
No new scientific run or repeat of completed #333 acceptance is required. Live
plot updates are inapplicable to these completed Guinier outputs. No YAML is
published and the Lab Recompile UI2 action is outside this task.
