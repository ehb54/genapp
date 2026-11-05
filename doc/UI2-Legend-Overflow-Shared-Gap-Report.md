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

## Deployment acceptance — November 5, 2026

Passed on Zazzie3 UI2, deployed core `650697077f45016a04fed662ec16e5420833f95d`
and application `991fe6bffe24` (implementation commits; later evidence commits
change documentation only). The canonical
`tools/zazzie3_gacpu_genapp.sh --generate-language ui2` passed readiness,
fast-forward, generation, 144 PHP syntax checks, 55 module-metadata checks,
container-identity preservation, public endpoint and installed-version publication.

The ordinary host-user Lab asset publication failed replacing the root-owned
`output/ui2/ajax/plot_presentation_lab.php` with Permission denied. The owner
explicitly approved retrying the same publisher with sudo. That retry passed;
Lab asset version is `20261105200320`. The remote account already had passwordless
sudo; no ownership, group, sudo-policy or account-privilege changes were made.
No Lab worker/API bypass, YAML publication or Lab Recompile action was used.

Authorized administrator codex3 reattached existing completed job
`db41e135-248c-4632-8ae4-ecfd29b80a23`, scenario/run
`mca_decomposition_exp_4_refine`. No scientific run was submitted.

- Ordinary React UI2: light and Slate surfaces at 550 CSS-pixel browser width,
  widening to 1100 and restoring. All eight entries, including both 1.0 D2O
  entries, remain visible below the data. Axes, title and legend are readable.
  Downloaded narrow scale-2 PNGs were visually inspected: both are 900×1016
  pixels and contain all eight entries within the image. Refresh reconstructed
  the completed plot from ordinary saved outputs.
- Native UI2 fallback: temporarily blocked only the React bundle through normal
  DevTools request controls. The same job passed 550/1100/550 widths on the light
  surface; all eight entries and readable axes/title were observed. Its narrow
  916×960 PNG was visually inspected and contains the complete legend. Native
  fallback's existing default trace styling was not changed by this correction.
- Lab: selected only MCA → Guinier fits, using the existing signed fixture.
  Light theme with contrasting dark canvas and matching light panel passed at
  550 CSS pixels. Widening and restoration retained all entries. The dark wide
  check used 1100 pixels; the light wide check used 1600 pixels. Both narrow
  scale-2 PNGs are 968×1016 and were visually inspected with all eight entries,
  complete names, readable axes/title and the established marks/colors.

Local downloaded evidence: `~/Downloads/newplot (74).png` (ordinary dark),
`(75)` (ordinary light), `(76)` (native light), `(78)` (Lab dark), and `(79)`
(Lab light). These browser downloads are evidence only and are not committed.

The eight measured/fit trace identities, order and concise I(0) values agree
across the saved completed job and Lab fixture. The correction only changes
renderer layout; neutral source/array/uncertainty immutability and caller parity
are covered by the automated checks above. This is targeted visual acceptance,
not a new scientific validation campaign or an audit of other plotting modules.
Live plotting is inapplicable to these completed Guinier outputs. Fresh separate
window, Chart Editor and the rest of completed #333 acceptance were not rerun.
Native dark-surface behavior is not separately claimed.

The temporary blocking rule was removed and blocking disabled; device emulation
and DevTools were closed. The original Slate theme and matching application-panel
setting were restored, the Lab tab was closed, and codex3 logout was visibly
confirmed on the login splash.
