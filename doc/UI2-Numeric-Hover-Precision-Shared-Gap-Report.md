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
is separate and remains pending.

The owner approved retaining existing formats for unresolved scientific
precision and recording them; `.6g` therefore remains the compatibility
fallback. He separately authorized the single deployed directives setting.
Neither decision certifies unknown scientific precision or authorizes other
server configuration changes.
