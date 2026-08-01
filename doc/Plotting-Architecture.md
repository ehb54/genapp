# SASSIE-Web Plot Generation

This is the normative implementation guide for adding a web plot to any
SASSIE module. GitHub issue `ehb54/zazzie#184` governs the architecture. The
experiment in `ehb54/zazzie#193` is rejected and must not be revived.

## The Contract In One Paragraph

SASSIE calculates science and writes its normal scientific outputs. When live
values already belong in the scientific run, SASSIE may also emit small,
ordered, GUI-neutral runtime events. The `genapp_zazzie` bin driver or a
module-specific helper converts existing values into an ordinary GenApp
`plotly` output. The shared GenApp driver runtime carries live updates,
completion, and reattachment. UI2 renders the plot and owns its visual policy.
There is no second plotting protocol, recorder, replay store, or plot-specific
reattachment artifact.

## Ownership

### SASSIE owns

- scientific calculations, algorithms, units, and canonical output files;
- scientifically meaningful sampling, averaging, interpolation, and derived
  quantities when they are useful outside the web GUI;
- ordinary progress or scientific runtime values already produced during a
  run.

SASSIE must not import Plotly, emit Plotly figures, encode browser layout, or
create GUI-only dataset/replay machinery.

### The `genapp_zazzie` driver owns

- mapping GenApp inputs to the SASSIE module;
- using `bin/driver_runtime.py` for progress, lifecycle, queue handling, and
  established runtime delivery;
- web-only preparation from existing SASSIE outputs or stream values, such as
  bounded sampling, combining related series, or converting rows to x/y data;
- the final ordinary JSON output whose keys match `modules/<module>.json`.

Web-only preparation must not redefine the science or become a canonical
scientific result.

### UI2 owns

- responsive sizing and resize behavior;
- fonts, theme colors, trace palette, line/marker styling, margins, and legend
  placement;
- modebar, interaction, export, accessibility, empty-state presentation, and
  final Plotly rendering.

The producer supplies scientific titles, axis names, units, series names,
axis scale, uncertainty, and subplot relationships. UI2 controls how those
items look and where presentation-only elements are placed.

## Required Implementation

1. **Confirm the data source.** Use existing SASSIE outputs or existing stream
   values. If a required scientific value is absent, stop and write a plain-
   language SASSIE-team request. Do not derive missing science in a web driver.
2. **Declare an ordinary output.** Add a stable `snake_case` output id with
   `"type" : "plotly"` in `modules/<module>.json`. Preserve existing ids so old
   jobs can reattach. Use a dynamic output group only when the number of plots
   is genuinely runtime-dependent.
3. **Keep plot preparation local and testable.** Put substantial conversion in
   `bin/<module>_plotting/` or another clearly module-owned helper. Reuse a
   shared helper only when it removes real duplication without obscuring the
   scientific meaning.
4. **Return ordinary Plotly data.** A plot payload contains `data` and the
   scientific parts of `layout`. Traces may provide x/y/z values, plot type and
   mode, series names, axis assignment, uncertainty, and scientific metadata.
   Layout may provide titles, axis names and units, scale type, and normalized
   subplot relationships.
5. **Leave presentation to UI2.** Do not emit fixed width or height, pixel
   margins, font sizes, theme/background colors, trace colors, line widths,
   marker sizes, fixed legend coordinates, modebar buttons, or general Plotly
   `config`. Do not hand-size a plot for either normal or expanded view.
6. **Use runtime events for live plots.** Events must be ordered, bounded,
   `snake_case`, GUI-neutral, and contain values rather than renderer objects.
   Consume them through the established `SASSIE_STREAM`/driver-runtime path.
   Do not poll files during a run, expose event records in the report textarea,
   or send unbounded history on every update.
7. **Make completion authoritative.** On success, the driver's final stdout
   JSON must include the completed plot under the declared output id. It may
   read a completed scientific output file once when that is the practical
   source. Use the normal `final_success_output(...)` pattern where applicable.
8. **Make reattachment automatic.** A fresh browser reattach must reconstruct
   the plot from the normal saved final output. It must not depend on browser
   memory, live events being replayed, a driver process still running, or a
   plot-specific sidecar file.
9. **Handle absence honestly.** Omit an optional plot when its option is off or
   its scientific data is unavailable. Do not return fake zero data or a blank
   placeholder figure. Use `items: []` only to clear an active dynamic group.
10. **Preserve command-line behavior.** The SASSIE GUI mimic and non-web run
    must continue to work without importing or depending on GenApp or Plotly.

Minimal static declaration:

```json
{
  "role": "output",
  "id": "scattering_plot",
  "label": "Scattering profile",
  "type": "plotly"
}
```

Minimal final payload:

```json
{
  "scattering_plot": {
    "data": [
      {
        "type": "scatter",
        "mode": "lines",
        "name": "calculated intensity",
        "x": [0.01, 0.02, 0.03],
        "y": [1.0, 0.82, 0.67]
      }
    ],
    "layout": {
      "title": "Scattering profile",
      "xaxis": {"title": "q (1/Å)", "type": "log"},
      "yaxis": {"title": "I(q)", "type": "log"}
    }
  }
}
```

The example intentionally contains no dimensions, colors, fonts, margins, or
toolbar configuration.

## Dynamic And Live Output Rules

- For a runtime-dependent number of plots, declare one dynamic `plotly`
  template with `"dynamicoutput" : "true"`, a unique `idprefix`, and a
  conservative `max`. Return the group key with `items`, each containing the
  ordinary plot payload in `value`.
- Omit an inactive optional group. Do not create a maximum set of blank static
  fields.
- A live update uses the same declared output id and payload shape as the final
  output. The final output replaces the live projection and is the reattach
  source.
- Bound live trace history and update frequency for browser and transport
  stability. The normal scientific output remains complete.
- Runtime event sequence numbers are monotonic within one job. Ignore duplicate
  or out-of-order events rather than redrawing stale state.

## Forbidden Architecture

Do not introduce or require:

- a GenApp `semantic_plot` field type;
- SASSIE `scientific_dataset.py` or scientific dataset recorders for plotting;
- dataset revision, recorder, or replay machinery;
- `.scientific_datasets.json` or another plot-specific reattach sidecar;
- a second plot transport beside the established driver/runtime path;
- live file polling;
- a migration-status registry as an implementation dependency;
- renderer objects or GUI presentation policy in SASSIE.

## Verification Gate

Before calling a new plot complete, verify:

- helper/driver tests preserve scientific values, units, ordering, uncertainty,
  and optional-mode behavior;
- runtime tests cover ordered live updates, bounded history, completion, and
  failure without leaking structured events into report text;
- final JSON contains the declared plot output and no prohibited presentation
  keys;
- normal view, expanded view, return to normal, completion, and fresh-window
  reattachment work on the deployed server;
- zero/empty data and every relevant optional input mode behave intentionally;
- the GUI mimic and command-line workflow remain independent of web plotting.

Detailed browser and scientific presentation validation is recorded in
`doc/Plotting-Acceptance-Matrix.md`. A module-specific display defect does not
justify a new plotting architecture; first determine whether the defect is in
the science values, driver preparation, shared runtime, or UI2 rendering.

## Preflight For Any Plot Change

Read the applicable `AGENTS.md` files in `genapp`, `genapp_zazzie`, and
`madscatt/zazzie`. Report the three guardrail hashes, issue `ehb54/zazzie#184`,
whether SASSIE changes are required, and whether a shared driver/helper gap
exists. Preserve unrelated work and do not move to another module group until
the current reference work passes its deployed acceptance checks.
