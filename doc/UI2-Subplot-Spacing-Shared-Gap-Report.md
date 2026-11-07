# UI2 Independent Subplot Spacing Shared Gap

Issue `ehb54/zazzie#321` reports an upper x-axis title colliding with a lower
panel. The smallest application attempt removed producer styling, fixed title
coordinates, title standoff and y domains while preserving scientific grid
relationships, titles, trace identities, values and uncertainty. MCA's existing
profile inheritance and role mappings remain sufficient.

An independent synthetic response/difference fixture reproduces the same gap
with no application names, role parsing or output ids. Before the fix, the
upper title overlaps the lower panel by 13.35 px at 640x460 and 16.18 px at
360x460 under the existing UI2/Lab geometry policy; expansion to 1100x740 clears
it. The corresponding Match Point overlaps are 15.29 and 18.12 px.

Existing view metadata wraps long plain titles or places named annotations
above a plot. Neither measures the vertical inter-panel title/tick lane.
Fixed producer domains or YAML spacing would violate presentation ownership
and cannot track available plotting height. The neutral maintained fixture is
`t/fixtures/plotly_subplot_spacing.html`; generic behavior coverage is
`t/unit_tests/plotly_subplot_spacing.t`.

## Original #321 contract and consumers

The view opt-in `plotPresentation.subplotSpacing: "avoid-overlap"` selects
a generic shared helper for independent one-column Cartesian panels. It
measures rendered labels and rebuilds display domains from the original panel
ratios, with bounded minimum panel sizes. Source payloads and scientific ranges
remain unchanged. UI2 and the Lab invoke the same helper after other geometry
fitting, including resize, redraw, completion and saved-output reconstruction.
No module/output branches, new producer flags, YAML changes or replay state
are introduced. MCA opts in; absent/invalid selections and unsupported grids
are unchanged controls. All MCA lanes require regression inspection because
the result-group selection also applies to its other multi-panel figures.

## Original #321 approval, verification and rollback

Joseph Curtis explicitly approved this generic core extension and exact
three-repository manifest in the current chat on October 15, 2026, following
the neutral reproduction and application cleanup. The existing task also
authorizes guarded commits, deployment and the described codex3 acceptance
block, with notification to Susan only after required checks pass. Separate
Lab Publish YAML and Recompile UI2 gates remain in force.

Verify neutral opted-in and non-opted-in behavior, source immutability, panel
ratios, invalid/unsupported layouts, idempotence, zoom, redraw, resizing, export
and saved-output reconstruction. UI2 and Lab must use the same helper. Run
UI2 and HTML5 generation checks; Linux/deployed acceptance remains distinct
from Mac checks. Deployed inspection covers all four theme/canvas selections,
actual grayscale, normal/expanded/restored plots, scale-2 PNG, Chart Editor,
completion, refresh and fresh-window reattachment.

Rollback removes the view selection and regenerates UI2/catalog; source saved
outputs require no migration. The generic helper and wiring can then be
reverted without changing scientific results.

## #352: multiple columns, secondary axes and historical figures

Joseph Curtis approved the revised eight-file implementation manifest and the
GenApp-core extension on November 6, 2026, explicitly local and uncommitted.
That approval does not authorize generation, deployment, publishing, account
access or changes to other plotting modules. The earlier #321 approval above
is historical and does not broaden this task.

### Evidence and smallest application-level attempt

TAMC's trajectory has four independent panels in two columns, with a secondary
vertical axis on the lower-left panel. Its experimental scattering output has
three vertical panels. Existing completed output declares independent axis
anchors/domains and the secondary overlay, but does not contain `grid`.

A local application-only trial selected title wrapping and measured spacing;
only copied scattering fixtures received grid metadata. At 600 CSS pixels the
trajectory still had four title/tick intersections and three titles extending
into neighboring data areas. At 1200 pixels the wrapped lower-right title
intersected the lower-left secondary-axis title. Expanded view cleared these
intersections but restoring reproduced them. The unchanged saved scattering
payload retained two q titles inside the next panel's data area, even expanded.
Closest and compare labels also obscured the trajectory's neighboring panel at
600 pixels. Four theme/canvas combinations reproduced these structural limits.

An anonymous four-panel figure with one secondary vertical axis reproduces the
failure without application identifiers, scientific roles or title parsing.
It and a three-row figure without grid metadata are now in the existing
`t/fixtures/plotly_subplot_spacing.html`, alongside the original #321 control.
Existing view metadata cannot reserve measured horizontal clearance or describe
that historical output as an explicit grid without changing the saved payload.
Adding producer grid metadata would help new output only. Fixed producer or
YAML geometry would violate the renderer ownership boundary.

### Expanded existing opt-in

The existing `subplotSpacing: "avoid-overlap"` selection now also supports
independent rectangular Cartesian panel arrangements described by reciprocal
axis anchors and normalized domains, including figures without `grid` and
secondary axes anchored to their existing overlaid panel. Scientific producers,
subplot ids/order, values, uncertainty, scales, explicit ranges and saved output
remain authoritative. No scientific boundary or transport changes.

The original one-column grid fitter remains in use for its existing supported
case. Other supported arrangements measure rendered titles/ticks, reserve
horizontal lanes and only the vertical lanes whose rendered rectangles can
intersect, then rebuild detached display domains from source width/height
ratios. Overlaid axes continue to follow their original panel. Wrapping, tick
clearance and spacing settle in bounded passes. Half-pixel display tolerance
avoids a resize loop caused by font/margin rounding.

Native closest/compare hit testing and tooltip content are preserved. The
opted-in helper moves native label groups together into the hovered panel and
its empty gutters/margins, keeping them outside neighboring data rectangles.
It restores its own transforms on unhover or removal of the selection. It does
not filter traces, hide curves, change hover values or modify saved data.

`GenAppPlotlyLayout.subplotSpacingStatus(plot)` exposes transient fit diagnostics
for validation. Unsupported relationships and insufficient allocations are
reported without shrinking a panel below 24 layout pixels; fitting is bounded
and an unsettled result is reported instead of certified. Single-panel output
is not applicable and absent/invalid selections do not opt in. A tooltip group
larger than the available safe region reports `hover: "insufficient-space"`
and retains native content; that condition is not passing hover acceptance.

Only TAMC's two output groups newly select wrapping plus spacing. The app view,
Lab catalog and TAMC fixture selection metadata agree. Fixture data/layouts and
normal completed-job payloads are unchanged. The core contains no module/output
names, scientific-role branches, theme/palette rules or replay state.

### Local verification and remaining acceptance

Focused Perl/Node and real Chrome checks cover the original one-column
lifecycle, opted-in/non-opted-in controls, no-grid rows, multiple columns,
secondary overlays, source/uncertainty preservation, minimum allocations,
idempotence, zoom, resize/expand/restore, redraw, reconstruction, actual pointer
closest/compare selection and values, scale-2 export and initial editor-layout
reconstruction. The latter uses a fresh Plotly render of the displayed handoff
with no corrective fit; it is not the actual Chart Editor application.

TAMC-only local evidence is retained under
`/private/tmp/issue352-local-implementation` on the development Mac. Both Lab
fixtures, the prediction control and unchanged completed output from job
`a1015465-d7fc-43f9-ac9f-a8d142b404f9` are checked across themes/canvases and
normal/narrow/expanded/restored sizes. The saved experimental plot retains all
154 scientific traces, including all 50 accepted-frame residual curves; the
additional null-data compact-legend proxy is presentation only.

Mac checks do not establish Linux or deployed acceptance. Actual UI2 shell
controls, live/completion transitions, native fallback, the Chart Editor UI and
authenticated fresh-window reattachment remain untested by this local task.
No generation, deployment, new scientific jobs, YAML changes or account use is
part of this approval. Other plotting modules remain outside the audit.

Rollback removes the two TAMC selections and reverts this generic extension;
source payloads need no migration. A reconstructed non-opted-in figure retains
its ordinary Plotly relationships and native hover. Any additional implementation
file or new schema/ownership boundary requires a revised approved manifest.

On November 7, 2026, Joseph Curtis approved `tell_susan_plus` for #352 with
the same eight-file scope. This authorizes guarded commits/pushes, the established
deployment workflow and scoped codex3 UI2 acceptance including logout, followed
by Susan's issue handoff only after acceptance passes. The separate Recompile
UI2 action-time gate remains pending; no YAML publication is needed.

## Content-height gap and approved Phase B (#352, November 7, 2026)

The earlier 626-pixel local checks missed the actual Lab's 480-pixel allocation.
At that height, experimental scattering and the unchanged completed TAMC payload
show axis-title intersections and q titles inside neighboring data panels.
Spacing can redistribute existing domains but cannot increase the allocation.
Short labels do not solve the lack of vertical room. Fixed producer/YAML heights,
scientific title changes and reductions in scientific sampling are excluded.

Phase A reproduces this failure in an application-neutral three-row figure in
both production native UI2 and a mounted React workbench. The real Lab page uses
only local mocked read APIs. It tests trajectory and prediction controls, both
scattering fixtures, and the unchanged completed-job payload with all 154
scientific traces and 50 residual curves. Initial actual Chart Editor rendering
and JSON export preserve titles/units, scales, explicit ranges and data. Actual
Chrome zoom at 80/100/125/150 percent is measured separately from viewport resizing.

Before renderer edits, the same unchanged baseline passed on zazzie in an
explicitly approved disposable Playwright 1.57.0 container: Linux x86_64,
glibc 2.39, Python 3.12.3, Chromium 143.0.7499.4; 90 neutral checks and the real
Lab/Editor cases passed as baseline-reproduction checks. Source mounts were
read-only. Evidence is under `/tmp/tamc-352-phase-b.IUlyY1tK/evidence/baseline`
on zazzie and `/private/tmp/issue352-height-phase-b/server-validation/linux-baseline`
on the development Mac. The container removed itself; deployed files and existing
application containers were not changed. The test image digest is
`sha256:3de745b23fc4b33fccbcb3f592ee52dd5c80ce79f19f839c825ce23364e403c1`.

Joseph approved the exact 16-file Phase B manifest, uncommitted, without deployment
or other plotting modules, and separately approved this temporary server runtime.
The generic new opt-in is `subplotHeight: "content-minimum"` together with the
existing spacing selection. It uses measured lanes and source row proportions to
reserve at least 80 CSS pixels of data height per row. Both consumer pipelines
reuse the helper and existing presentation queue; bounded passes must settle.
Only TAMC scattering selects it. Native selection routing carries the new key.
No application/scientific identifiers enter the core helper. Non-opted-in,
invalid, single-row and unsupported figures retain prior behavior.

Height ownership is transient and limited to the plot host's `min-height`.
Recompute for narrower/wider allocation, viewport and source changes; release
excess height on fewer rows and restore the original value/priority on removal
or teardown. Do not overwrite newer author changes. No CSS, React source,
generated React bundle, vendor, editor implementation or scientific code changes
are authorized. Any such need requires a revised manifest. Source reconstruction
and teardown use existing paths; no new observer, transport or saved state exists.

Correction acceptance must pass the focused neutral and TAMC checks on Mac and
Linux, source/metadata parity, actual allocation resize and expanded/restore,
hidden/reveal, row/selection removal, authored-style restoration, no idle loops,
actual closest/compare pointer values, zoom retention, scale-2 PNG, real Editor
handoff and actual TAMC browser zoom. Keep non-opted-in trajectory and generic
controls unchanged. Deployed lifecycle and authenticated reattachment remain
pending under this no-deployment scope. Rollback removes only the scattering
height selection and reverses this height extension; saved outputs need no change.

The final height path distinguishes the SVG canvas from host padding, quantizes
opted-in panel boundaries to renderer pixels, and protects the readability floor
against rounding. Within an allocation/content generation it grows monotonically;
width, viewport or source changes recompute the natural allocation and permit
shrinkage. A bounded four-pixel lane allowance can move an unresolved measured fit
off a rounding threshold. The generation-wide change budget prevents self-induced
resize callbacks from restarting that budget indefinitely. None of these rules
apply to spacing-only consumers.

Final correction validation passed on November 7, 2026. The native/React neutral
suite passed 120 checks on both the development Mac and zazzie's temporary Linux
runtime. These include actual allocation resize/restore, hidden/reveal, zoom
retention, pointer coordinates, row/selection removal, authored minimum-height
and priority restoration, idle settlement, scale-2 PNG and teardown. The existing
spacing-only regression suite also passed. The actual mounted React Expand
workspace and Restore split view controls passed a separate focused check.

The actual Lab and bundled Chart Editor passed both reported fixtures, the
prediction control and the unchanged completed-job payload on Mac and Linux.
Experimental and saved scattering passed all four light/dark and matched/contrast
surface combinations, narrow/wide/restore, source parity, scale-2 PNG, initial
Editor rendering and Editor JSON export of titles/units, scales and explicit
ranges. Actual Chrome zoom covered every fixture at 80/100/125/150 percent:
17 measurements cover 16 fixture/zoom combinations, all collision-free with
unchanged science. Chrome zoom was restored to 100 percent and the local test tab
closed. All 154 scientific traces and 50 residual curves remain; the existing
null-data compact-legend proxy remains presentation-only.

The non-opted-in trajectory control retains the baseline's numeric
`geometry-pass-limit` diagnostic at 125-percent zoom; rendered labels remain
clear and source/data remain unchanged. This height change does not alter that
control or represent deployed issue acceptance.

Final Linux evidence is under
`/tmp/tamc-352-phase-b.IUlyY1tK/evidence/candidate3` on zazzie, mirrored to
`/private/tmp/issue352-height-phase-b/server-validation/linux-final` on the Mac.
Mac evidence is in `quantized-neutral`, `quantized-lab` and
`quantized-react-controls` below `/private/tmp/issue352-height-phase-b`.
The Mac automated browser executable reports Chrome 156.0.8078.80; the pinned
Linux runtime uses Chromium 143.0.7499.4. Runtime/input SHA-256 fingerprints match
the final candidate. An earlier combined Linux run was interrupted after its
neutral suite passed; final acceptance uses a fresh complete combined run.
Every disposable validation container removed itself. No deployed file,
existing application container, scientific code, source payload or plotting
module outside TAMC was changed. The 16-file change remains uncommitted.
Deployed completion and authenticated reattachment remain pending, as required
by this task's no-deployment scope.


### Approved deployed acceptance

After Phase B validation, Joseph explicitly approved `tell_susan_plus` for #352,
including Recompile UI2 through the canonical workflow and codex3 administrator
acceptance with logout. The same 16-file manifest governs guarded commits/pushes,
application fast-forward, canonical UI2 regeneration and the #352-only browser
checks. Existing completed-job data are the acceptance source; other plotting
modules and scientific changes remain excluded. Susan's issue handoff is
conditional on all required deployed acceptance passing. The earlier
no-deployment/uncommitted statements above describe the completed Phase B scope,
not this later authorization. Deployed results will be reported on #352.


## #352 saved-job width validation, November 7, 2026

Joseph approved the five-file validation-only manifest and a disposable
Playwright container on zazzie. This approval authorizes no renderer edits,
commit/push, deployment, account access, scientific run or other plotting module.
The ordinary server working copies were older than deployed code and remain
untouched. Uncommitted validation work is isolated under
`/tmp/tamc-352-width.RBnWLnC7/{genapp,genapp_zazzie}` on the existing branch names.

### Missed coverage and maintained reproduction

The former height fixture constructed a static graph, supplied a child width,
and adjusted allocation width through `widthTo`. The Lab test copied the saved
figure into a Lab fixture, not its production dynamic-output wrapper. Those
checks established height behavior but did not certify saved-job width sizing.

`t/fixtures/plotly_subplot_height.html` now also exposes `widthProbe`. It uses
production field/output creation, dynamic item updates and actual React mounting,
including the ordinary field row and control stack. Dynamic charts initialize
hidden and reveal through real allocation observation. This path never invokes
`widthTo`, forces a graph/instance width, changes a grid track, or manually fits
after reveal. Static controls mount visibly. Each case measures parent content,
graph and SVG boxes, pending resize and afterplot events; fitting has a 15-second
bound and a two-second stability requirement. A short follow-up records growth.
The Perl entry point owns the neutral current/previous, native/React,
static/dynamic, selected/unselected matrix. It uses core JSON::PP so the approved
container needs no added Perl package. The prior height assertions remain active.

Application coverage is
`sassie_genapp_tests/test_tamc_saved_plot_width.py` with
`sassie_genapp_tests/fixtures/tamc_352_saved_plots.json`. It loads an unchanged
copy of the deployed UI2 shell and real runtime, module/view, CSS and React bundle;
only backend/session/result responses are mocked on container loopback. It uses
normal saved-job reconstruction, actual result tabs and Expand/Restore controls,
viewport transitions, hidden/reveal and independently reconstructed new pages.
No live session, credentials, real submission or deployed endpoint is used.
Blocked controls are recorded as errors for that state, not a pass or a reason
to skip unrelated later cases. This is isolated validation, not deployed Jobs
acceptance. The saved fixture contains the original plot objects only, with no
report, viewer paths or account state. Structural equality with the existing
saved output is checked; 154 scientific scattering traces and 50 accepted-frame
residual curves remain unchanged. The existing null legend proxy stays display-only.

### Attribution

The same dynamic-width failure occurs with the pre-height-fix core `65069707`
and deployed core `2a0ca8c9`, using identical scientific objects and CSS. It also
occurs in neutral native/React dynamic cases without the height selection.
Therefore the #352 height option is not necessary for the failure: this is a
pre-existing dynamic-output sizing defect exposed by the missing validation.
These tests do not quantify whether the height fit amplifies its growth rate.

The observed mechanism is consistent with the implicit dynamic grid track
accepting an intrinsically sized SVG, then autosizing the padded graph from that
allocation and feeding a larger size back into the track. Recorded graph/SVG
increments and padding/border measurements support that explanation. This is
not yet approval for a CSS or resize-loop correction; a particular repair has
not been implemented or selected. No producer dimension, sampling reduction,
new schema or plotting architecture is needed for this validation.

### Evidence and limits

Immutable runtime references are deployed application `1568bb3c`, current core
`2a0ca8c9` and archived core `65069707`. The runtime integrity receipt confirms
all renderer sources and deployed browser assets are unchanged. The pinned
Playwright image is
`mcr.microsoft.com/playwright/python@sha256:3de745b23fc4b33fccbcb3f592ee52dd5c80ce79f19f839c825ce23364e403c1`,
using Chromium 143.0.7499.4 and Playwright 1.57.0. Sources are mounted read-only;
network is disabled and evidence is the only writable host mount. Browser/client
packages are confined to the disposable container or the temporary task folder.

Final evidence is `/tmp/tamc-352-width.RBnWLnC7/evidence/final`: the application
`width-results.json`, neutral `neutral/neutral-width-results.json`, original
height `height/neutral-results.json`, logs, screenshots, execution statuses and
SHA-256 receipts. Earlier interrupted/intermediate probes are retained separately
and do not replace final evidence. The original height suite passes 120 checks.
The width regressions intentionally fail while the sizing defect remains.
Fresh-page tests do not establish authenticated deployed fresh-window Jobs
acceptance; #352 and Susan handoff remain incomplete. Stop at failure attribution
and obtain a separate exact repair plan/approval before any renderer change.


Final result: the strict neutral matrix records eight bounded static controls
and eight dynamic width failures across both revisions, native/React, and
selected/unselected height metadata. Every neutral scientific/source parity
assertion passes. Final full-application coverage attempted 17 states: 16
measured width failures and one blocked current-core React Restore action.
All 16 measured states retain scientific parity: 154 source traces and
154 or 155 display traces, depending on the renderer and its existing
presentation-only legend proxy. The older core reproduces normal and fresh-page failures in both
renderers. Earlier comparison evidence also measures its expanded/restored,
hidden/reveal and narrow/wide/restored React cases. No state with failed width
or a blocked action is counted as accepted. Browser exception lists are empty.

The complete Perl run passes the existing height assertions (120 underlying
checks) and fails its new width regression. The separately rerun strict neutral
entry point also fails only the intended width assertion. Application and core
exit statuses are both 1, the expected red baseline before any fix. Final
strict neutral evidence is `neutral-strict/neutral-width-results.json` and
`neutral-strict/unit.log`; the original neutral run is retained as well.
The strict rerun strengthens wall-clock/stability and scientific-parity checks;
it does not change the renderer or the existing height harness behavior.
Current-core Restore remains unverified, and amplification of growth by the
height fit remains unquantified. No fix is proposed by this validation result.


## #352 production rollback — local and uncommitted

The working tree restores the pre-#352 production code: GenApp 4b6c1aa4 and
application f90261e, using only the approved rollback manifest. Earlier #352
sections are historical evidence, not current implementation or acceptance.
The deployed release remains 2a0ca8c9 / 1568bb3 until a separately authorized
deployment; this rollback does not certify or repair the saved-job width defect.
Original TAMC title collisions are expected to return. #353–#356 are retained.

The spacing fixture/test and application parity test use their pre-#352 versions;
the #352 versions remain preserved in commits c622d25b, 2a0ca8c9, 0d6b7da and
1568bb3, and in the rollback evidence before/ snapshot. The height/width fixture
and runner, saved scientific fixture, saved-job width test, and captured
evidence under the existing temporary validation roots are retained unchanged.
#352 feature-validation runs require their recorded revision; missing removed
APIs must not be treated as successful validation. Known width failures remain
failures and are not relabeled as acceptance.

Rollback validation passed in the approved disposable Linux Playwright container
(Chromium 143.0.7499.4): the original spacing helper contract,
20 neutral browser assertions, five JavaScript syntax checks
and two Python syntax checks. No browser exceptions occurred. The restored
files match their pinned pre-#352 Git blobs exactly; the historical report is
append-only. All 116 fingerprinted retained evidence/test files are unchanged.
These checks certify the local rollback, not a width fix or deployed acceptance.
Evidence: /tmp/tamc-352-width.RBnWLnC7/evidence/rollback.


### Approved rollback deployment

Following the validated local rollback, Joseph explicitly approved committing,
pushing and deploying this exact 16-file scope, including canonical Recompile UI2.
The earlier local/uncommitted statements describe the completed validation phase.
Deployment must retain #353–#356 and the saved evidence; it does not close #352
or repair the pre-existing saved-job width defect. Verify deployed runtime and
Lab assets against the rollback commits. No new plotting fix, other module work,
YAML publication or administrator-account access is included.
