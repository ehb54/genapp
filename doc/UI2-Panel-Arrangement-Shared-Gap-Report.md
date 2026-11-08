# View-selected panel arrangement and compact legend gap

## Reproduction and attribution

TAMC #352's approved offline trials demonstrate the desired appearance, but
their browser display-copy edits are not a production implementation.
Existing view metadata supports measured one-column spacing only; it cannot
select a two-column arrangement with a panel spanning rows, pixel minimum
gaps, or the tested two-column row-wise legend.

The application-neutral fixtures are t/fixtures/plotly_subplot_spacing.html
(?arrangement=1), t/unit_tests/plotly_subplot_spacing.t, and
t/unit_tests/plot_presentation_legend.t. On the unchanged rollback renderer,
both contract probes failed at their explicit MISSING_CAPABILITY assertions.
Real Chromium/Plotly also reproduced the missing arrangement. These are
expected baseline failures, not scientific or transport failures.

Evidence on zazzie: /tmp/tamc-352-width.RBnWLnC7/evidence/tamc-352-production-arrangement.
The initial host-Node and mistyped-image launch failures are preserved there.
The successful tests use the exact cached image from container-baseline-command.json,
offline, with sources read-only and evidence writable. No host packages installed.

## Generic contract and ownership

plotPresentation.subplotLayout selects bounded arrangements of opaque Cartesian
axis-pair ids, horizontalGap/verticalGap minima in CSS pixels, and optional
positive rowWeights. Repeated cells form a rectangular spanning panel. Select
only the arrangement whose distinct panels exactly match the source's independent
anchored Cartesian panels. Overlay axes follow their existing parent. Unknown,
malformed, mismatched or too-small allocations retain ordinary behavior.
No source axes, scales, ranges, values, names or saved figures are rewritten.

plotPresentation.legendLayout selects columns: 2, order: row,
groupTitles: hidden. Shared helpers prepare detached display layout/traces;
the existing legend fitter retains responsibility for bottom-lane allocation.
Only redundant group headings are hidden, never names or compact-family keys.
Existing compact-family thresholds, scientific sampling and interactions remain.

UI2 and the application Lab consume the same helpers. Existing resize,
completion, reattachment, PNG and initial-editor settlement paths are reused.
No height-allocation changes, YAML changes, module-id/role branches,
new transport, scientific calculations or other plotting-module changes.

## Approval, controls and rollback

Joseph explicitly approved the 21-file plan and shared-core work after neutral
baseline validation, then approved container execution and continuation.
Non-selected and legacy one-column controls must retain prior behavior.
Application selection is limited to the two TAMC result groups.
Rollback removes their new selections and reverts these opted-in helpers;
shorter labels may remain independently. Preserve #353–#356 and old evidence.

## Acceptance state

Baseline confirmed. Private implementation and production-path validation passed; deployed acceptance pending.
Local fixture success is not deployed acceptance. Required checks include the
saved completed payload, real resize, expanded/restore, themes, closest/compare
hover, full legend identities, PNG and initial Chart Editor handoff.
Deployed codex3 acceptance and logout remain required before Susan handoff.

## Approved amendment and width attribution

The first production-path run found the prediction dynamic child wider than
its pane. A baseline/candidate comparison in the same isolated UI2 shell
showed the unchanged renderer also overflowing (940 → 1000 → 1060 pixels);
additional candidate fitting amplified the same SVG/grid minimum-width feedback
(1760 → 2150 → 2470 pixels). No streaming path was involved.

A one-rule private CSS trial setting the pane-fitted dynamic grid item's
minimum width to zero produced exact pane-width fits: 479.203, 863.203,
479.203 pixels, with scientific parity and the 120-pixel gap preserved.
The user approved adding only languages/ui2/add/css/ui2.css to the manifest
(22 files total), responsive one-column legend fallback when needed, and the
approved shorter labels on legacy job display copies without stored edits.

Private trials confirmed six prediction cases across React/native and three
React legacy-trajectory cases. A native saved-trajectory readiness probe showed
both native plots eventually rendered but exceeded the test wait while the full
old 154-trace scattering payload also rendered its legacy legend. Do not treat
that probe as deployed acceptance. Its DOM snapshot is preserved. The runner
isolates the trajectory output for that focused native check; full saved-job
coverage remains required on the primary React UI2 path.

The first measured 117-pixel lane had no collisions; tick/title fitting changed
the available width after spacing. The helper now uses settled margins in
bounded passes. Prior failure logs/screenshots remain. The amended production-path matrix passed without display injections: 21 Lab,\n56 React, and three focused native saved-trajectory cases. The primary React\nchecks included the full saved scattering plot, expansion/restore, light/dark\nfresh windows, 36 closest/compare hovers, and PNG/editor export. An expanded\nsaved-job delay was traced to 255 ordinary per-trace hover redraws (20.3 seconds).\nSelected-panel hover restoration and fitting now batch updates; the same\n20-second check passed with five redraws, preserving values and precision.\nThe old saved payload and all failure evidence remain untouched.
