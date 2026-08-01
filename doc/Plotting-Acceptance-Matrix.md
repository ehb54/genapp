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
| Tools | data_interpolation | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Tools | extract_utilities | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Build | prepare_solvated_system | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | contrast_calculator | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | multi_component_analysis | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | contrast_variation_analysis | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Contrast | rg_center_of_mass_distance_calculator | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Simulate | torsion_angle_monte_carlo | Plotly | not_recorded | not_recorded | not_recorded | not_recorded | |
| Simulate | monomer_monte_carlo | Plotly and NGL | not_recorded | not_recorded | not_recorded | not_recorded | Reference module |
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

- The shared driver/runtime migration is complete when the module has the
  normal driver final-output and reattachment path.  Detailed browser results
  are recorded above as they are obtained.
- `madscatt/zazzie#434` tracks the broader TAMD structure and SAS/P(r) stream
  work.  Native progress and Rg events are now consumed without driver-side
  file polling.
- `madscatt/zazzie#435` covers retirement of SAS Assembly presentation
  artifacts that are not needed by the web driver.
- The rejected `ehb54/zazzie#193` design must not be revived.
