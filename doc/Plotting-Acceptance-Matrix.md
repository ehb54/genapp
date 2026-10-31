# Plotting Acceptance Matrix

This matrix records browser acceptance for the initial SASSIE-web plotting
port governed by `ehb54/zazzie#184`.  It is a progressive functional check,
not a demand to complete all scientific or visual review before the common
driver/runtime port is accepted.

## Rules

- Record one row per active menu module that currently declares Plotly or image
  output.
- Check normal view, expanded view, restore-to-normal, completion, and a
  fresh-window reattach against a scientifically valid run.
- Record a separate defect when a plot is empty, clipped, loses data, or
  changes scientific values.  Do not use a module defect to redesign the
  shared runtime without evidence of a real shared gap.
- Image outputs are checked for display and reattach, not as Plotly figures.
- The SASSIE scientific output remains authoritative.  This matrix does not
  authorize changes to science, sampling, units, or output tables.

Status values are `not_recorded`, `passed`, `failed`, or `not_applicable`.

## Active module inventory

| Group | Module | Output kind | Normal | Expanded / restore | Completion | Reattach | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tools | data_interpolation | Plotly | passed | passed | passed | passed | `madscatt/zazzie#507` records 2026-10-02 deployed codex3 acceptance of normal, expanded/restore, completion, same-window and fresh-window reattachment, plus Plot Presentation Lab preview; diagnostic annotation has no arrow and q² remains data-driven |
| Tools | extract_utilities | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Build | prepare_solvated_system | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | contrast_calculator | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | multi_component_analysis | Plotly | passed | passed | passed | passed | `ehb54/zazzie#291` records deployed Match Point success, expanded/restore, completion, refresh, and fresh-window reattachment; controlled automatic-fit failure preserved its report and omitted the plot and successful completion state |
| Contrast | contrast_variation_analysis | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | rg_center_of_mass_distance_calculator | Plotly | passed | passed | passed | passed | `madscatt/zazzie#208` records deployed single-frame PDB and multi-frame DCD acceptance on 2026-09-29; both completed with the Rg/COM plot and summary, passed same-window and fresh-window reattachment, and the multi-frame plot passed expanded/restore inspection |
| Simulate | torsion_angle_monte_carlo | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Simulate | tamd | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | Native live stream integrated; deployed check pending |
| Simulate | sas_assembly | Plotly and images | not_recorded | not_recorded | not_recorded | not_recorded | Density images remain ordinary outputs |
| Calculate | sascalc | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Calculate | sld_mol | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Calculate | em_to_sas | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Calculate | asaxs | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Calculate | capriqorn | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Analyze | chi_square_filter | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Analyze | hullradsas | Plotly and NGL | not_recorded | not_recorded | not_recorded | not_recorded | |
| Analyze | bayesian_ensemble_estimator | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Analyze | eros | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Analyze | altens | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |

## Tracking boundaries

- MMC was removed from this active inventory when support was withdrawn. The
  failed browser evidence in `ehb54/zazzie#249` remains historical context and
  does not define pending acceptance work or a revival plan.
- The shared driver/runtime migration is complete when the module has the
  normal driver final-output and reattachment path.  Detailed browser results
  are recorded above as they are obtained.
- `madscatt/zazzie#434` tracks the broader TAMD structure and SAS/P(r) stream
  work.  Native progress and Rg events are now consumed without driver-side
  file polling.
- `madscatt/zazzie#435` covers retirement of SAS Assembly presentation
  artifacts that are not needed by the web driver.
- The rejected `ehb54/zazzie#193` design must not be revived.

## Data Interpolation annotation recovery — 2026-10-02

- Issue: `madscatt/zazzie#507`; authorized administrator account: `codex3`.
- Deployed runtime: GenApp `f5dea869972915eec81dc7758c6746377064e6c4`
  (annotation fix `795e269a`); application `a13679b142f80d06b26009a3e122548c171d8e2b`.
- Scenario: `data_interpolation_documented_automatic_31`; completed job
  `f36c4f78-b1d5-4a88-b806-2cddd488cf09`; scientific scenario verification passed.
- Normal, expanded/restore, completed, same-window reattach and the normal
  Job Manager **Attach in new window** path passed. Direct browser inspection
  showed the q² ticks at 0 through 0.0025, visible data and fit, above-plot
  diagnostic text, and no annotation arrow. The ordinary profile also rendered.
- The deployed Plot Presentation Lab Guinier fixture passed with the same
  placement helper and data-driven q² range. No YAML was published or edited.
- Local evidence: 792 UI2/HTML5 checks, five Lab parity tests and 15 real-Plotly
  fixture checks passed, including autorange, source immutability, explicit
  ranges, multiple annotations, and zoom across react/resizing.
- Both authorized browser sessions were logged out after acceptance.


## General x/y tick-label fitting — #334

October 27, 2026: passed on Zazzie3 UI2 with authorized administrator
account codex3. Deployed GenApp `bb7e6750`, application `5df5b6e`, and SASSIE
routing-only commit `2805a7e6a`.

- Data Interpolation scenario `data_interpolation_documented_automatic_31`:
  job `96622176-39d5-4582-934e-349995254ff3`; scientific verification passed.
- MCA scenario `multi_component_analysis_decomposition_exp_4_no_refine`:
  job `1e8269da-772d-45c8-87d3-f5b5ff8996d8`; scientific verification passed.
- Both passed normal, expanded/restore, zoom/pan/reset, completion,
  same-window and fresh-window reattachment, PNG and Chart Editor handoff.
  Independent rendered-label rectangle checks passed, including fresh-window
  plots. Source scientific values were unchanged.
- Additional live geometry/export checks passed: 15 Data Interpolation and
  14 MCA checks. The deployed Lab passed 111 checks across nine fixtures,
  light/dark themes and matched/contrasting canvases, with zoom/reset,
  PNG and Chart Editor scientific-series parity.
- Local and Linux validation is recorded in
  `UI2-Tick-Density-Shared-Gap-Report.md`. The canonical UI2 deployment wrapper
  passed readiness, generation, syntax/metadata and public-endpoint checks.
- codex3 was logged out after acceptance and the Lab was closed. No YAML was
  published and no Lab Recompile UI2 action was used.

## Issue 335 — uncertainty-aware reporting

The shared `uncertainty-2` capability passed the deployed reference checks below.
Unknown scientific precision retains its existing format by explicit owner
direction; no all-quantity scientific precision certification is claimed.

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

## All-plot hover-name suppression — #336

October 27, 2026: passed on Zazzie3 UI2 with authorized administrator `codex3`.
Deployed GenApp `3b0c3231`, application `e0799f5`; SASSIE routing-only
`efaf1fce6` is pushed. Existing saved plots and all future ordinary Plotly outputs
inherit the application directive without producer or saved-result migration.

- Data Interpolation job `bd016cd1-76aa-45d1-9d30-f9e5c9be361b` and MCA job
  `831cd987-f1ff-4d97-bdef-934558184f44` passed scientific scenario verification,
  completion, same-window and fresh-window reattachment.
- 46 UI2 checks passed across plot result tabs: normal/resized (1100/1600),
  expanded/restore, zoom/reset, rendered hover values with no curve names,
  unchanged arrays/uncertainty/names, no tick collisions, PNG and initial editor.
  Additional closest/x/y/unified hover and pointer pan/reset checks passed.
- Old saved job `53ba443b-30e6-43e7-b657-84230473edcc` passed normal Job Manager
  fresh-window attachment with unchanged source science and hidden hover names.
- Lab: 64 cases across 16 fixtures and four theme/surface combinations passed.
  Actual 3D and heatmap pointer hovers passed eight further surface cases,
  retaining point details. Lab PNG and initial editor handoff passed.
- Local Chrome fixture: 109 checks. Lab parity: 21 tests, including immutable
  preservation of all 102 captured fixtures. Final Linux focused suites: 10
  harness assertions passed. Seven passing local suites: 812 assertions.
- The broader runtime suite has a pre-existing object-identity assertion failure,
  reproduced with unmodified `677b225d` sources. It was not changed or claimed
  as passing. Detailed reproduction and applicability limits are in
  `UI2-Hover-Name-Suppression-Shared-Gap-Report.md`.

The initial submission refusal in an existing locked project was handled by
creating a fresh acceptance project through normal controls; no lock was cleared.
Live appends are neutral-fixture coverage; the two new deployed cases plot at
completion. No scientific/driver/YAML changes or Lab rebuild actions occurred.
The canonical UI2 deployment and Lab static-asset publication passed. Temporary
windows were closed and `codex3` logout confirmed. Unrelated local work and
staged entries were preserved.

## MCA figure-title extension (#333, October 31, 2026)

Owner-approved shared-core implementation: generic `figureTitleOverflow: "wrap"`
with MCA view/Lab opt-in. Local validation: the 799-check core suite passed
(two optional hover-browser checks skipped), including target filtering/HTML5
isolation and axis/tick/hover regressions;
React no-emit type checking passed. Application checks passed 127 tests, with
three pre-existing Data Interpolation parity failures reproduced before this
extension. The broader `ui2_runtime_logic.t` stops at an existing reference-
identity assertion in the hover display path; the identical failure was reproduced
using HEAD copies of all four runtime helpers in a temporary baseline tree.
This suite therefore does not establish full runtime regression acceptance.
The generated Lab catalog is current; fixture coverage is 113.
The neutral browser fixture passed 66 checks at 320/488/900 CSS pixels in
light/dark, including toolbar/annotation/tick separation, restore, zoom/reset,
empty/fresh replacement, unchanged science/source and a 976-by-960 scale-2 PNG.
The fixture checks initial editor layout transfer; deployed editor acceptance
remains pending. No deployment acceptance is claimed by this entry. The previous deployed application e5a501c
on core e80ce452 completed an eight-figure signed job but failed normal-gallery
figure-title bounds (9.09375 CSS pixels right overflow). Expanded view fit.

Pending acceptance: corrected title bounds and annotation/tick/legend separation,
normal/expanded/restore and resize, signed/positive cases, Lab surface matrix,
PNG/editor, native fallback, completion and same/fresh/historical reattachment,
other MCA modes. The previous browser block ended with confirmed codex3 logout.
Detailed scope and neutral fixtures: `UI2-Figure-Title-Overflow-Shared-Gap-Report.md`.
