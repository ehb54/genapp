# Numeric hover precision shared gap — issue 335

Owner approval: Joseph Curtis approved the plan, exact manifest, and shared
GenApp core changes in this chat on October 27, 2026; then authorized replacement
of the prior three scope records. Commit/deployment and codex3 acceptance are
conditional on successful required validation. No Lab publication is involved.

The previous application selection `.6g` pads value and error independently.
A neutral trace `x=[0.227], y=[0.0007922]`, with absolute `error_y.array=[0.000338]`,
therefore cannot express coupled reporting through one format string.
Trying `.2g`, `.4~g` or `.6~g` alone cannot align the value's decimal place to
the uncertainty at every point. Existing view metadata specifies no such
relationship; module-specific formatted strings would duplicate a global rule.
Plotly's native error hover also reconstructs errors from endpoints and can
lose small uncertainties beside large central values.

The approved generic string selection is `uncertainty-2`, described in
`Plotting-Architecture.md` and `UI2-Core-Extension-Policy.md`. It uses existing
absolute data arrays and detached hover-template strings, no new producer
protocol. Unrelated applications retain existing behavior. Existing D3 string
selections are controls. The neutral browser fixture is
`t/fixtures/plotly_numeric_hover.html`; arithmetic/lifecycle controls are in
`t/unit_tests/plotly_numeric_hover.t`. Application fixture/coverage controls
live in the paired SASSIE-web approved tests. No application/module/role ids
occur in core. Unknown precision is a scientific-owner question, not a renderer
guessing opportunity.

Compatibility: the opt-in intentionally supersedes explicit numeric coordinate
formats when positive finite supplied uncertainty determines precision. It
preserves template text and units, source arrays, metadata/customdata and saved
outputs. Existing legacy format selections retain their old precedence.
Unsupported/absent uncertainty relationships retain compatible display and
remain explicitly unresolved in the application audit. Rollback selects the
previous D3 string and regenerates UI2; reconstruct from unchanged saved output.

Acceptance requires rendered normal/expanded/restore, closest/compare/unified,
updates, completion, fresh-window reattachment, supported scatter/bar/3D and
matrix controls, immutability, generated UI2 and unchanged HTML5 behavior.
Local evidence and deployment evidence must be recorded separately. Never
record deployed acceptance based on a merge or passing arithmetic alone.

## Local evidence and owner decisions

The final uncertainty-aware neutral browser fixture passed 185 checks with
Plotly 2.35.2 in unauthenticated temporary Chrome. Relevant generic arithmetic,
tick/hover compatibility and target-generation tests passed 37 Perl assertions;
application/Lab coverage passed 25 tests. A separate actual-generation check
confirmed the new policy in generated app-map, byte-identical generated helper,
and 1,208 unchanged HTML5 JavaScript assets. Authenticated deployed acceptance
is recorded below and in `Plotting-Acceptance-Matrix.md`.

The owner approved retaining existing formats for unresolved scientific
precision and recording them; `.6g` therefore remains the compatibility
fallback. He separately authorized the single deployed directives setting.
Neither decision certifies unknown scientific precision or authorizes other
server configuration changes.

## Deployed acceptance — October 27, 2026

Deployed application commit `4142e88fd94238504e6d42627388c64f51838064` and
GenApp core `677b225d047d52b21ff35dec963b15d3c4b74bca` through the canonical
`tools/zazzie3_gacpu_genapp.sh --generate-language ui2` workflow. Readiness,
container-identity preservation, UI2 generation, 144 generated PHP handlers,
55 runtime module metadata files, public endpoint verification and verified
installed-version publication passed. The only configuration change was the
separately approved hover selection in Zazzie3's deployment directives.

Authorized administrator `codex3` used the isolated acceptance Chrome profile
with its listener verified at `127.0.0.1:9222`. The documented acceptance runner
passed `data_interpolation_documented_automatic_31` in project
`issue335_hover_20261027`, job `53ba443b-30e6-43e7-b657-84230473edcc`.
Completion and both same-window and new-window reattachment passed. A separate
fresh-window native hover check also displayed `x: 0.227000` and
`y: 0.00079 ± 0.00034`, reconstructed from the normal saved final output.

Native browser checks passed normal, expanded and restored layouts, resize,
zoom, pan/reset and closest/compare hovers. DOM measurements found zero
same-axis tick-label overlaps: 1920×963 viewport, 723.5-pixel expanded plots
(16/11 ticks on profile/Guinier), 880.2-pixel restored profile (17 ticks),
1280×813 viewport with 496.2-pixel profile (9 ticks; 12 after zoom/pan), and
1511-pixel fresh-window profile (24 ticks). Scientific coordinate, uncertainty,
metadata and customdata arrays matched the unmodified source figures.
Axis titles and legends were also visually inspected at these sizes.

PNG export at the narrow displayed size passed visual inspection. The initial
Chart Editor handoff retained the source values `0.0007922` and `0.000338`,
its prepared `0.00079 ± 0.00034` template and zero measured tick overlaps
(19 labels). The Lab's production Data Interpolation fixture showed that same
hover in both light (`#ffffff`) and dark (`#1a201f`) surfaces; each retained
scientific arrays with zero measured tick overlaps (21 labels). No YAML was
edited, saved or published, and no Lab Recompile UI2 action was used.

Data Interpolation publishes these scientific plots at completion, so a live
streaming-plot state is inapplicable to this deployed reference run. Ordered
append/replacement/empty/repopulation behavior and supported 3D preparation were
covered by the neutral local fixture; no additional deployed 3D or live-module
acceptance is claimed. The owner-approved unresolved precision cases remain
recorded separately; this validates the uncertainty-aware capability, not
scientific precision for every quantity or historical producer format.

All temporary acceptance/editor/Lab tabs were closed. `codex3` logout was
confirmed in UI2. Existing unrelated local files and staged work were preserved.
