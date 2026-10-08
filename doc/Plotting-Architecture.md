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
- responsive axis-title overflow and client-only word-boundary wrapping when
  an application view opts into that generic presentation capability;
- modebar, interaction, export, accessibility, empty-state presentation, and
  final Plotly rendering. The standard UI2 toolbar keeps responsive rendering
  and scroll-wheel zoom, uses PNG export at scale 2, removes box/lasso select
  and retired Chart Studio controls, and enables compatible spike-line and
  hover controls. It stays in a single horizontal lane and scrolls horizontally
  in a narrow pane rather than wrapping. UI2 places every Plotly legend slot
  below the plot in ordered horizontal rows and reserves the required bottom
  margin. Each control has a mouse-hover tooltip and accessible name; keyboard
  focus reveals the toolbar, remains visible on the selected control, and lets
  Enter or Space perform its action. A declared local Chart Editor remains an
  optional generic addition.

UI2 selects paper and plot backgrounds before applying non-data contrast. One
shared surface resolver evaluates the actual final CSS colors, including alpha,
then supplies readable figure text, axes, grids, legends, hover labels,
annotations, and modebar controls. This presentation pass does not alter trace
data or scientific identity and is reused by application preview tools.

An application presentation profile may also provide optional
`light_surface` and `dark_surface` palette overlays. UI2 classifies the actual
final plotting surface after background preference and alpha compositing, then
overlays the matching partial palette before resolving trace style tokens.
Missing variants, missing tokens, and unavailable classification fall back to
the base palette. Ordinary UI2 and application preview tools use the same
resolver.

The producer supplies scientific titles, axis names, units, series names,
axis scale, uncertainty, and subplot relationships. UI2 controls how those
items look and where presentation-only elements are placed.

When explanatory text must remain inside a Plotly figure, the producer may
give the annotation a stable `name` and the application view may map that name
to the generic `plotPresentation.annotationPlacement` value `above_plot`.
UI2 measures and stacks those opted-in annotations in a responsive top lane;
the source figure remains unchanged for completion and reattachment.

For annotations selected as `above_plot`, UI2 supplies complete paper-coordinate
placement and disables arrows before the first Plotly render or update. The
subsequent measured pass adjusts the responsive lane and margin without using
scientific axes for placement. Preparation must not mutate the saved figure;
unnamed and unselected annotations retain their declared behavior. Application
preview tools use the same preparation helper before rendering.


An application may set `ui2_plotly_hover_number_format` to a bounded numeric
D3 format: `.0e` through `.15e`, or `.1g`/`.1r` through `.16g`/`.16r`.
Missing or invalid settings preserve ordinary Plotly behavior. The shared
`GenAppPlotlyLayout.applyNumericHoverFormat` helper applies the default after
Plotly resolves axis types, including numbered Cartesian axes and 3D scenes.
It skips date/category axes and preserves explicit axis formats, including
formats inherited from a Plotly template. Supported non-coordinate numeric
trace values, such as a heatmap's z matrix, use their schema-declared formats.
Explicit trace formats and producer-authored template text/inline formats
remain authoritative; unformatted template placeholders inherit the default.
Normal UI2 and application previews call this same idempotent helper on
detached display data, without changing scientific arrays or saved outputs.
The policy persists across redraw, bounded updates, resize, completion, and
normal final-output reattachment. It does not introduce new uncertainty labels
or repair Plotly's existing endpoint-subtraction precision limitations.

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
   `config`. Do not hand-size a plot for either normal or expanded view, and do
   not insert responsive `<br>` markup into scientific titles.
   Applications with a local Chart Editor declare that generic capability once
   in their UI2 directives; UI2 applies it across normal rendering and saved-job
   lifecycles. Figure-level editor configuration is a legacy compatibility
   override, not the application-wide declaration path.
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

### Repeated-family presentation

For repeated members of one scientific family, a producer may add an opaque,
deterministic `meta.series_group` without changing `meta.series_role`.
Application views may opt that role into a generic group palette. UI2 uses the
group only to select appearance channels; it must not infer science, reorder
traces, or use the value as runtime or reattachment state. Missing grouping
metadata is a presentation-only fallback, not a plotting error.

### Patterned bars and histograms

Presentation-selected marker patterns default to Plotly `fillmode: "overlay"`
so the resolved series color remains behind the pattern. This preserves the
solid background used by Plotly to contrast embedded labels and supplies a
non-color cue in grayscale. Explicit producer pattern settings, including
`fillmode`, remain authoritative. Ordinary UI2 and application previews use the
same helper; scientific arrays and saved source payloads remain unchanged.

## Preflight For Any Plot Change

Read the applicable `AGENTS.md` files in `genapp`, `genapp_zazzie`, and
`madscatt/zazzie`. Report the three guardrail hashes, issue `ehb54/zazzie#184`,
whether SASSIE changes are required, and whether a shared driver/helper gap
exists. Preserve unrelated work and do not move to another module group until
the current reference work passes its deployed acceptance checks.

### Hover-label trace identity

The final-surface resolver leaves Plotly hover-label color properties
unspecified unless the figure already declares them. After presentation colors
resolve, Plotly selects the line or hovered-point color, including per-point
arrays and colorscales, and contrasts the label foreground and border against
that background. Do not inject a neutral plot-wide hover background, text color,
or border color. Explicit layout, trace, and template hover styling remains
authoritative. Ordinary UI2 and application previews use this same policy.

Closest and x/y compare hover use individual trace-colored labels. Unified
hover retains Plotly's shared box and colored series keys. This changes display
only; scientific arrays, uncertainty, axes, saved outputs, and reattachment
remain unchanged. No new application directive or producer metadata is needed.

Native Plotly contrast is not a universal 4.5:1 guarantee. With Plotly 2.35.2,
white label text on `#ea580c` has a measured contrast ratio of approximately
3.56:1. Keep that limitation visible during acceptance; stricter contrast
requires separately scoped renderer work rather than a module workaround.

## Numeric axis tick notation

A result group may opt into `plotPresentation.axisTickFormats`, mapping ordinary
Cartesian axis names (including numbered x/y axes) to bounded numeric D3
formats. Supported formats are `.0e` through `.15e`, `.1g`/`.1r` through
`.16g`/`.16r`, optionally with `~` before the type to trim trailing zeros.
For example, `{"xaxis": ".4~g", "yaxis": ".4~g"}` selects concise adaptive
labels with up to four significant digits.

The shared `GenAppPlotlyLayout.prepareNumericTickFormat` helper prepares
detached axis objects before rendering in UI2 and application previews. It
applies only to explicitly declared linear/log axes. Missing or invalid
settings, absent/inferred axes, and date/category axes retain ordinary Plotly
behavior. Explicit axis or template tick formats, tick-format stops, and
custom tick-text arrays remain authoritative. The setting changes notation
only: values, uncertainty, titles, units, axis types/ranges, hover formats,
final outputs, and reattachment contracts remain unchanged. Reapplying the
setting is idempotent; removing it restores the original saved figure behavior.

Plotly 2.35.2 uses a `fakehover` formatting path for some default log-axis
decade labels. An axis hover default can consequently pad those ticks. A
separate explicit display tick format avoids that path without reducing hover
precision. Test both ticks and hover labels after redraw, resizing, updates,
completion, and reconstruction from saved final output. The generic helper
must never branch on application, module, output, or scientific-role names.

## Compact legends for repeated families

A view's `plotPresentation.traceRoles` mapping may select
`legend: {"mode": "compact", "title": "Repeated observations"}` for an opaque
series role. The shared `GenAppPlotPresentation.styleTraces` helper applies
this opt-in to detached display traces in ordinary UI2 and application previews.
Families with up to four eligible members list every original trace name
beneath the supplied family title and count. Larger families hide individual
entries and append one generic, sample-free display key named from the title
and count. It must not name a specific member as the representative of others.
The key has null coordinates, no scientific metadata, and no hover content;
it adds no plotted samples or axis extent. Native legend-group interaction
controls the corresponding real traces. Existing legend slots and producer
groups remain separate; traces with `visible: false` are excluded.

Every real trace retains its original name, metadata, scientific arrays, order,
and hover behavior. Source layouts and saved outputs remain unchanged. The
reserved `_genappCompactLegendProxy` marker identifies display-only keys, which
are removed before repeat preparation; at most one key is added per large
family. Empty data removes the group; completion and reattachment reconstruct
it from the ordinary final payload and current view. Removing the opt-in
removes the display keys and restores the original presentation.
Missing or invalid policies retain existing behavior. Titles must be nonempty
strings of at most 200 characters. A role-level `legend: "show"` also explicitly identifies a single
named trace that Plotly's automatic legend would otherwise omit.

Issue `ehb54/zazzie#304` supplied the neutral repeated-family reproduction:
showing 100 members through the existing per-trace policy produced 100 entries.
The owner approved this generic collection-level opt-in, its exact file scope,
and deployment. Core selects only declared opaque roles, never module ids,
output ids, scientific terms, or trace-name parsing. Tests cover opt-in,
controls, producer groups, empty/populated/cleared/repopulated data, immutable
source payloads, and saved-output reconstruction. HTML5 generation is unchanged.

## Full hover names

A result group may opt into `plotPresentation.hoverNameDisplay: "full"`.
The shared `GenAppPlotlyLayout.prepareHoverNameDisplay` helper sets the default
hover-name length to `-1` on a detached display layout before rendering.
Missing or invalid selections preserve ordinary Plotly behavior. Explicit
layout, trace, and template name lengths, including per-point arrays, remain
authoritative. Other hover styling and producer-authored templates remain
unchanged. Ordinary UI2 and application previews use the same helper.

This is presentation only: scientific trace names, arrays, uncertainty, numeric
formats, axes, units, saved outputs, and reattachment contracts do not change.
Apply the selection again when rendering updates, completed output, or saved
final output. Verify closest and compare-data hover on overlapping long names,
light and dark surfaces, expanded/restore views, and saved-output reconstruction.
Removing the view selection restores native behavior from the original figure.
