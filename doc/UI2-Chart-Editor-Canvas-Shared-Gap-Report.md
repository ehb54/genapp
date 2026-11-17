# Preserve the fitted Chart Editor canvas

Issue: ehb54/zazzie#363. Owner approval: Joseph approved the exact 15-file
editor plan with `tell_susan_pluss` (interpreted as `tell_susan_plus`) on
2026-11-17. The separate five-file integer-frame correction remains scoped.

## Demonstrated boundary

UI2 and the application Lab fit titles, ticks, panel headings, spacing and
legend columns before handoff. The existing editor envelope carries data,
layout and config; width and height are removed and autosize enabled. The
standalone editor then places that fitted layout beside its controls without
loading the shared presentation fitter. A 760px editor window leaves about
324px for a four-panel canvas before plot margins. Headings, ticks, secondary
axis titles and legend entries collide or clip. Existing view wrapping and
two-to-one legend fitting work in UI2/Lab but are not rerun in the editor.

The application-level integer correction reuses explicit Plotly axis formats
and bounded ticks from actual frame identities. It does not fix editor shell
allocation. No scientific values, units, identities or producer geometry are
missing. No new presentation algorithm or scientific backend change is needed.

## Neutral reproduction and contract

`t/fixtures/chart_editor_canvas.html` opens the real standalone editor with
neutral single/two/four-panel figures and a long legend. A source canvas of
700 by 600 CSS layout pixels is fitted independently of the editor sidebar.
`t/unit_tests/chart_editor_canvas.t` checks the baseline compression and the
candidate, controls, old envelopes, invalid hints, user edits and downloads.

The optional envelope member `editor_viewport: {width, height}` carries the
settled Plotly layout dimensions. Each must be a finite numeric value; width
is 240–8192 and height 160–8192. Both must validate or the entire hint is
ignored. The hint is editor shell metadata, not a Plotly layout property,
application/module selector, scientific field or exported JSON/CSV value.
Absent/invalid hints preserve the existing envelope behavior.

For valid hints the editor holds the fitted canvas in a scrollable shell.
Controls initially collapse only if they prevent that canvas from fitting;
the user can explicitly show/hide them. Window resize and control toggles do
not refit annotations, legends or scientific axes. Explicit user layout width
and height override the corresponding shell dimensions. Deliberate edits to
layout and data remain authoritative and survive toggle, resize and download.
Existing save/export semantics and dependency versions remain unchanged.

## Compatibility, controls and rollback

The opt-in is the valid viewport hint. A no-hint envelope is the non-opted-in
control. Old editors ignore the additive member; source figures are detached
and unchanged. Both UI2 and Lab supply the same hint after their existing
fit/export settlement. No `plotly-layout.js` or React workbench change is
permitted. Removing the hint from the two senders restores old shell behavior.

## Release gate

Before release, compare the unchanged active Tools-through-Simulate fixture
inventory before/after across UI2 React/native, Lab, editor transfer, PNG,
resize/restore and JSON/CSV values. Record actual sizes/states and expected
editor-shell differences. Preserve edited layouts and linked scientific arrays.
Any regression or untested required state blocks handoff. Local validation
is recorded below; deployed acceptance remains a separate release check.


## Preflight and local evidence (2026-11-17)

Governing plotting issues are ehb54/zazzie#184 and #203; this correction is
#363. The three preflight AGENTS.md Git blob hashes were:

- SASSIE: `3207901ae6f6e511cdcc36eefddacec3d73b19a6`.
- Application: `5f70c62ffb01a46ac930f4d7e416117824bb1a9f` (including the
  user-requested release gate).
- GenApp: `fdd19da6e2af1b8b4d968e2733e25f4277c735e3`.

SASSIE remains read-only. No scientific output or driver-runtime gap was
found. The demonstrated shared gap is editor canvas allocation only.

Local checks use macOS Chrome, Python `/Users/curtisj/anaconda3/bin/python`
and the checked-out Node/Perl tools:

- 52 neutral browser assertions pass for single/two/four-panel figures,
  legacy/invalid hints, controls, resize, deliberate title/axis/legend/size
  and line/marker edits, and JSON/CSV downloads.
- Eight focused TAP checks pass for native geometry, numeric hover and ticks.
- UI2 generation passes 752 assertions; the unrelated HTML5 assembly artifact
  remains unchanged.
- 64 application tests pass. One pre-existing invalid-escape warning originates
  in the Rg/COM fixture's source, outside this change.
- 24 producer cases, including empty and 10,000-frame inputs, differ only in
  the five intended x-axis display properties. Only the two intended TAMD
  fixture entries differ; all scientific arrays remain identical.

The application baseline advanced from `f60e5a8` to `af9f656` during review
because the separate #362 task committed nine Lab workflow files. Work stopped;
Joseph explicitly approved rebasing the validation baseline on `af9f656`
without expanding the 18-file combined manifest. The isolated Lab status
fixture now supplies #362's required `git_publication: 1` capability. No #362
production file is edited by this task.

The completed local release gate covers 77 unchanged active fixtures across
15 modules in each of Lab, React UI2 and native UI2. Each before/after pair
covers 760→1440→760 browser widths, measured labels/axes, two real PNG
downloads per phase, initial editor transfer, JSON/CSV data, and deliberate
layout edits through control toggles and 1440/550/760 editor resizing. All
scientific values and PNG hashes match. The expected difference is preservation
of the source fitted canvas instead of compression beside the editor controls.
The hint remains absent from downloaded scientific JSON.

All 77 Lab fixtures were rechecked on `af9f656`. React/native passed on
`f60e5a8`; #362 changed neither renderer nor the shared fitting helpers.
The React runner required a test-only tab-mount wait correction; 19 completed
cases and a 62-case continuation cover the same 77 unique fixture ids. Lab
workers were partitioned; the redundant full worker stopped after 24 completed
cases, and the union of independently passing cases covers all 77 ids.
Raw evidence and the checked inventory union are under
`/private/tmp/editor-release-gate-summary.json` on the validation machine.

The TAMD-specific rendered gate also passes on `af9f656`: 72 states, 28 hover
checks and six PNG/editor transfers, including both plots, themes/surfaces,
zoom/pan/fractional windows/reset, resize, expansion/restore, bounded updates,
completion and fresh-page reattachment. Local evidence is under
`/private/tmp/tamd-363-af9f656-3`. These isolated browser checks do not claim
live scientific execution or deployed acceptance. Live UI2 acceptance and
logout are required before the issue handoff.
