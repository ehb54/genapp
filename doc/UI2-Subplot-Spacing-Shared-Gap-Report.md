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

## Contract and consumers

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

## Approval, verification and rollback

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
