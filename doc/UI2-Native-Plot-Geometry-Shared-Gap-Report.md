# Native UI2 plot geometry routing

Joseph Curtis approved the shared-core fix and exact ten-file manifest on
October 31, 2026 for ehb54/zazzie#333.

## Evidence and scope

At application ea7ba8a / core e685a644, native job
0a8fb308-91bc-4f53-8608-8c383306fce1 rendered five positive-data figures.
Three log plots at 613.57 CSS pixels had long decimal ticks clipping left and
overlapping the y-axis title. React rendered concise ticks correctly.
The view already selects .4~g. React FieldGroup attaches data-plot-presentation;
native output hosts do not. The previous resolver read only that DOM metadata.
An application-neutral in-memory reproduction confirmed the missing selection.
All scientific values exist; no SASSIE or driver/helper change is required.

## Contract

The geometry resolver reads explicit host metadata first. Otherwise, native
outputs resolve their current declared parent id against results.groups.
Identical group selections are accepted, conflicts fail open to existing
behavior, and missing or malformed metadata does not invent settings. Dynamic
children inherit the parent declaration; no child-name inference is used.
Only the six existing geometry/tick keys documented in the core policy pass
through. Hover, profiles, trace styles and legend policies are not forwarded.
Existing helper validation, producer precedence, fit queue, PNG and editor
handoff remain authoritative. No new schema, transport, sidecar or YAML is added.

## Verification and rollback

Run the focused unit test and neutral browser fixture plus existing title, tick,
hover, UI2 generation, target-filtering and HTML5 isolation suites. Exercise
static/dynamic, empty/repopulated and replacement hosts, absent/conflicting
metadata, explicit tick overrides, source immutability and hover preservation.
Browser checks cover 320/488/614/900-pixel plots, resizing, zoom/reset, hidden
host reveal, PNG and initial editor transfer.
Deployed signed/positive, historical and other-mode reattachment, native and
React interactions, Lab surfaces and exports remain required before handoff.
Restore browser controls and log out. Local success is not deployed acceptance.
Rollback reverts the scoped routing change; saved jobs need no conversion.

## Local evidence — October 31, 2026

- JavaScript syntax check passed. Focused native resolver plus figure-title,
  tick-format and tick-density suites passed (four files, ten harness assertions).
- Existing numeric-hover, hover-identity, hover-name, axis-title, subplot-spacing
  and scene-contrast suites passed (21 harness assertions). The optional compact
  legend browser suite was skipped because GENAPP_LEGEND_BROWSER was unset.
- Native availability/dynamic lifecycle focused runtime block passed. The broader
  runtime suite retains its previously recorded unrelated hover reference-identity
  failure; no assertion was weakened or changed.
- Application MCA plotting and view regression tests: 48 passed.
- Neutral real-Plotly Chrome fixture: 1,997 assertions passed across ten
  width/surface cases (320/488/614/900 CSS pixels, light/dark, restore),
  zoom/reset, clearing/repopulation, hidden reveal, scale-two PNG and detached
  editor-layout transfer with scientific-array parity. This fixture exercises
  the production resolver extracted from ui2.js; it does not claim full browser
  Chart Editor or deployed authentication/reattachment acceptance.
- YAML, generated presentation registry, views, drivers, SASSIE, hover helpers
  and trace styling code have no changes.

Deployment and the full authorized codex3 acceptance block remain pending the
separate UI2 recompile approval. Susan must not receive a passing handoff yet.

Local UI2 generation, language filtering, HTML5 overrides and HTML5 assembly
passed together: four files, 836 harness assertions. Deployed correction remains
pending; the existing native failure is not yet marked resolved.

## Remaining short-title clearance — October 31, 2026

Joseph Curtis approved the shared fix and exact fourteen-file manifest.
At deployed core eaeb8839 / application 1822990, the original log-tick problem
was corrected, but positive job 0a8fb308-91bc-4f53-8608-8c383306fce1 retained
an overlap between 0.0015 and q-squared axis title at 613.57 by 480 CSS pixels.
The saved signed result passed that measured check. Codex3 was logged out;
Susan was not notified. The screenshot's scrollable output container is not
by itself evidence of a separate legend defect.

The old helpers measured tick/tick collisions and title wrapping, not title/tick
clearance. An application-neutral in-memory case produced no correction. The
browser fixture now extracts production layout, legend fitting and the complete
fit chain from ui2.js and supplies neutral linear multi-trace data. A reduced-scale
stress case fails against the committed old helper with `0.001 / u² (a⁻²)`
overlap, and passes with the correction. This is a neutral regression, not a
claim to reproduce the precise deployed plot at every browser zoom setting.

Shared fitting measures the missing lane, adds standoff and the matching outer
margin, and preserves explicit automargin settings. It converts measured CSS
pixels to layout pixels and shares tick fitting's lifecycle, event guard and
export promise. Up to four clearance passes are allowed; unresolved geometry
blocks acceptance. No SASSIE or driver work is required.

Local validation:

- Five focused clearance/native/title/tick suites: 13 harness assertions passed.
- UI2 views/generation, target filtering, HTML5 overrides and HTML5 assembly:
  836 harness assertions passed.
- Six tick-format/hover/subplot/scene suites: 20 harness assertions passed.
- Application MCA/view/Lab parity: 70 passed; three pre-existing Data
  Interpolation expectations still fail (cutoff value, extra log-log output,
  and its tick-format selection). They were not weakened or changed.
- Isolated headless Chrome, real Plotly: 4,752 checks across 38 width/surface/scale
  cases (28 linear, ten logarithmic). Measured widths 214.39 (stress), 320, 488, 613.56, 900 and 1122 CSS
  pixels, all 480 high, normal and 0.67 display scales, light/dark, wide/narrow
  restore, range change/reset, clear/repopulate, hidden/reveal, PNG dimensions,
  detached editor layout, source and hover preservation passed. CSS scaling is
  a stress analogue, not a substitute for deployed browser zoom acceptance.
- YAML, registry, catalog, view, driver, SASSIE and hover helper code unchanged.

Deployed correction and the full prior acceptance scope remain pending separate
UI2 recompilation approval. Do not mark #333 accepted or notify Susan yet.
