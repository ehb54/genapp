# SASSIE-Web Plotting Recovery

GitHub issue `ehb54/zazzie#184` is the corrected governing issue. The
architecture attempted in `ehb54/zazzie#193` is rejected for this work.

## Ownership

- SASSIE owns scientific calculations and normal scientific output files.
- GenApp and `genapp_zazzie` bin drivers own web-only plot preparation when a
  GUI workflow needs sampled, interpolated, combined, or streamed values.
- The existing driver/runtime contract owns JSON output, runtime events,
  progress, completion, and reattachment.
- UI2 owns responsive sizing, fonts, colors, labels, legends, modebar behavior,
  empty states, and the final Plotly rendering adapter.

Plotly remains the current browser renderer for web plots. It is not a SASSIE
contract and should not leak producer-specific sizing or theme policy.

## Explicit Rejections

Do not add or require:

- a GenApp `semantic_plot` field type;
- a SASSIE `scientific_dataset.py` plotting layer;
- dataset recorder, revision, or replay machinery in SASSIE;
- `.scientific_datasets.json` as a GUI reattachment requirement;
- a second plot-specific reattach store;
- a migration-status registry as a completion gate;
- file polling on the live plotting path.

## Migration Rule

A module is not considered migrated just because a plot renders. It is migrated
when the module uses the current bin/driver contract cleanly, removes
unnecessary duplicated plot-building code, leaves visual policy to UI2, and
passes deployed browser checks for normal view, expanded view, completion, and
reattach.

If a module cannot produce the needed plotting values from existing SASSIE
outputs or existing stream data, stop and write a plain-language request for the
SASSIE team. Do not build a GenApp workaround that hides a missing science-side
capability.

## Practical Contract

Drivers/helpers may prepare data series and may read a completed output file
once at the end of a run when that is the practical source of final plot data.
They should use stable snake_case identifiers and shared helper code where it
reduces duplicated Plotly assembly.

Producers must not hand-code plot dimensions, fonts, theme colors, margins,
legend placement, or toolbar policy. Those belong in UI2.

## Reference Gate

MMC is the reference recovery module. No next module group should be migrated
until MMC works on the deployed server for:

- live Rg and convergence plots;
- SAS and P(r) average plus representative sample behavior;
- optional experimental-data residuals only when experimental data is selected;
- normal view and expanded view;
- transitions between views;
- completed-run output;
- new-window reattach.
