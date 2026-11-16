# Responsive panel-heading shared gap (#364)

## Attribution and neutral baseline

TAMD's four-panel Lab fixture placed headings at fixed paper coordinates.
Application-only wrapping, panel gap and legend trials cleared label-to-label
collisions but left top headings inside data panels at narrow allocations.
`subplotLayout` adjusts domains without associating annotations with panels.
`annotationPlacement: above_plot` ignores unnamed annotations and stacks named
annotations above the entire figure, rather than above individual panels.

The persisted neutral fixture is `t/fixtures/plotly_panel_headings.html`.
It uses generic Group A–D headings, independent Response A–D panels, synthetic
arrays and one overlay axis. No application id or scientific term participates.
Before shared-core edits, `?baseline` reproduced heading intrusion with the
unchanged helper. The selected path contains an explicit
`MISSING_CAPABILITY: panel-relative headings` assertion requiring the new helper;
the recorded pre-edit browser run used the baseline path.
The baseline measured annotation-group intrusions of 3.5 CSS pixels at
694 by 522, 0.5 at 801 by 580, and 3.5 after restoring the narrow size. Group
bounds include annotation padding; earlier text-only probes measured 2 pixels.
Source figures and arrays remained unchanged.

## Contract and implementation

The normative schema is in `Plotting-Architecture.md` and
`UI2-Core-Extension-Policy.md`: bounded, explicit `panelHeadings` associations,
unique names or guarded index/exact-text selectors, and existing independent
Cartesian panel ids. The renderer owns wrapping, centering and measured lanes.
Malformed/ambiguous selections leave ordinary behavior unchanged. No producer,
YAML, transport, replay or scientific calculation changes are involved.

One shared helper participates in the existing geometry/tick/title queue.
UI2 and the Lab forward the selection and await the same settlement paths.
The application opt-in is limited to TAMD coverage. Source figures and saved
jobs are never rewritten. Legacy exact-text selectors let existing coverage
figures use the current view mapping without changing the scientific producer.

## Approval and scope

Joseph explicitly approved the 20-file plan and shared-core implementation,
then approved adding the generated application `static/catalog.js` as file 21
after its maintained parity test demonstrated the need. That implementation
approval excluded commits and deployment. Joseph subsequently requested GACP
across the approved 21 files and tell_susan_plus; the separate Recompile UI2
gate remains in force. Existing worktree edits remain preserved. Scientific code, YAML,
React bundles and other generated assets remain excluded.

## Controls, validation and rollback

The neutral control retains its original annotations when unselected. Existing
`above_plot`, independent subplot, native geometry and figure-title controls
retain their contracts. Remove the application heading/layout selection to
roll back TAMD; revert the generic opt-in helper separately if necessary.
No saved-job migration or scientific rerun is required.

Focused contract and browser validation is recorded below when complete.
Local fixture validation does not establish deployed acceptance. Live UI2
acceptance, including normal/expanded/restored and fresh-window reattachment,
requires a separately authorized session and deployment.


### Local validation completed 2026-11-16

The final offline application run passed 38 measured states: 14 Lab, 13 React
and 11 native fallback. Every state had no label collisions, heading/panel
intrusions or clipped labels; scientific arrays, identities, axis titles/units,
explicit ranges and scales were preserved. It covered actual viewport resizing,
React workspace expansion/restoration, Lab light/dark matched/contrasting
surfaces, closest/compare pointer hover, zoom/pan/reset, bounded appends,
completion, tensor-trace absence, full-output absence and fresh-context
completed-fixture reconstruction. Native fallback used a temporary renderer
selection in the offline response; its scientific payload and source view
were unchanged. Native has no React workspace expansion control.

All three surfaces passed real scale-2 PNG downloads and initial Chart Editor
transfer with data/identity parity and snapshot consumption. Exported PNGs were
visually inspected. The report contains six closest/compare pointer checks,
three PNG/editor checks and no browser errors. The saved fixture, scientific
producer and generated scientific fixtures were unchanged.

Evidence: `/private/tmp/tamd-364-full-final/results.json` and the screenshots,
PNG downloads and editor captures in that directory. Earlier failed attempts
are retained in `/private/tmp/tamd-364-full-r1`, `-r2` and
`/private/tmp/tamd-364-editor-debug`. The editor failure was an offline asset
route missing the application prefix, corrected in the test. The partial-output
failure identified Plotly's omission of unused rendered axes; the shared fitter
now uses declared display domains without fabricating a trace or value.

Validation used `/Users/curtisj/anaconda3/bin/python` and installed Google Chrome
in isolated disposable profiles, with mocked local responses and external
requests blocked. No scientific native-extension or simulation validation was
needed because no scientific or driver code changed.

Application checks: 80 tests passed with:

```bash
~/anaconda3/bin/python -B -m pytest -q -p no:cacheprovider \
  sassie_genapp_tests/test_plot_presentation_lab_catalog.py \
  sassie_genapp_tests/test_plot_presentation_lab_plotly_parity.py \
  sassie_genapp_tests/test_plot_presentation_schema.py \
  sassie_genapp_tests/test_plot_presentation_role_mapping.py
```

GenApp's `plotly_panel_headings.t`, `ui2_native_plot_geometry.t`,
`plotly_subplot_spacing.t` and `plotly_figure_title_overflow.t` passed (14 TAP
checks, including the explicitly enabled neutral browser test). The separate
real native/pane allocation fixture passed 4,986 assertions over 34 recorded
linear/log and scaled cases, including hidden/reveal, rapid resize and teardown.
Other optional browser hooks in the Perl suites were not enabled; the neutral
and native browser runs above are the recorded rendered evidence. JavaScript
syntax, comment-aware view/catalog parity and whitespace checks passed.

No historical server-job payload, live simulation or deployed acceptance was
performed. Fresh-context checks reconstruct the completed fixture; they are
not proof of historical server-job compatibility. No commit, deployment, YAML
publication or UI2 recompile occurred. #364 remains pending deployed acceptance.
