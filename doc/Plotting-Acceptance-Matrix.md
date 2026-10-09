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
