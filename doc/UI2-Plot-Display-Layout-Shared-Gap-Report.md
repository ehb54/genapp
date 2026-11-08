# View-selected plot display layout — #352

Owner approval: Joseph Curtis approved the exact 16-file local, uncommitted
implementation in this chat. Tests must precede renderer edits; stop on the
first unexpected failure. No deployment or other plotting modules.

The trajectory-only trial passes nine layouts and 54 hovers at the immutable
`evidence/tamc-352-saved-spacing-completion/` reference. Its display copies use
960 CSS pixels, explicit x domains, axis-title wrapping and word-preserving
hover line breaks. Current view metadata cannot express these settings: the
catalog discards them and native geometry resolution does not forward them.
The earlier #352 measured height/spacing implementation remains rolled back.

Neutral reproduction: `t/fixtures/plotly_view_display.html` uses four independent
Cartesian panels plus a secondary y axis and opaque series roles. It records
ordinary unselected behavior before requiring the two new bounded APIs.
`t/unit_tests/plotly_view_display.t` runs it in the isolated Linux browser.

Proposed contract: `plotPresentation.displayLayout` permits a positive finite
integer CSS `height` and an `xAxisDomains` map of existing non-overlay x axes to
increasing finite pairs within [0,1]. Invalid maps are ignored atomically.
`hoverTemplateLineBreaks` maps opaque `meta.series_role` identities to templates
whose sole changes are whitespace/line breaks; words, tokens, precision, other
markup and `<extra>` contents must agree. Unsupported templates remain unchanged.

Prepare detached display copies before existing hover-name suppression and
formatting. Own only the selected host inline height, restoring its previous
value on removal unless a newer external value superseded it. No width or resize
observer changes, module branches, YAML geometry, producer changes or saved-output
migration. Existing rendering and resize paths remain authoritative.

The application opts in only `plotout4`. Non-opted-in neutral controls must retain
source domains, host sizing and hover text. Removing the TAMC selections restores
ordinary rendering; core changes can then be reverted independently. Scattering,
its prior width defect, other modules and deployed acceptance remain excluded.

## Local validation — 2026-11-08

The Linux baseline passed its expected-failure gate before renderer edits.
The neutral fixture subsequently required UI2's explicit autosize setting and
normal resize sequence; its corrected 34 checks pass. An isolated diagnostic
reproduced the original 480/960 mismatch and confirmed the UI2 sizing sequence.

All 11 catalog tests and the existing subplot-spacing/native-geometry
regressions pass. The unchanged production-path browser runner passes 31
layout/lifecycle checks, 54 lower-panel hovers, and three PNG/initial Editor
handoff checks across saved React/native output and the trajectory Lab fixture.
This is trajectory-only local evidence, not deployed acceptance.

Evidence is preserved on zazzie under
/tmp/tamc-352-width.RBnWLnC7/evidence/: tamc-352-production-local,
tamc-352-neutral-height-diagnostic, tamc-352-validation-resume, and
tamc-352-validation-dependencies. Earlier failures remain intact.
The tracked tamc_352_saved_trajectory.json fixture contains the exact
plotout4 values from the original saved payload; the original evidence and
its scattering output are not modified.

Deployment and codex3 acceptance are pending. The broader scattering portion
of #352 is excluded, and this change does not close the issue.
