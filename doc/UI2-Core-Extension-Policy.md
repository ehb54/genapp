# UI2 Core Extension Policy

Status: accepted 2026-08-01.

This policy prevents an application-specific UI defect from becoming a hidden
GenApp UI2 behavior. It applies to the native UI2 runtime, React workbench,
generated UI2 assets, and their tests.

## Default boundary

Application work starts in the application repository. A module task may change
its view metadata, module declaration, driver, and tests. It must not change
GenApp UI2 core merely because one module has an undesirable screenshot.

| Concern | Owner |
| --- | --- |
| Grouping, cards, tabs, wide/gallery/stacked arrangement, prominence | Application `views` metadata |
| Scientific values, units, uncertainty, titles, series identity, subplot relationships | Application driver/helper |
| Theme, responsive dimensions, margins, fonts, palette, legend presentation, modebar, accessibility | UI2 |
| Structure topology, coordinates, frame identity, scientific volume values | Application driver/helper |
| NGL controls, camera, background, opacity, local frame playback, responsive sizing | UI2 plus application metadata |

The producer must not emit UI2-specific layout, color, legend, modebar, or
viewer-lifecycle directives. UI2 does not inspect module ids, output ids, or
application-specific scientific terms.

## Application-shell navigation

An application may opt into the generic accordion sidebar with
`ui2_module_navigation: "sidebar"` in its directives. The default `strip`
preserves the centered selected-menu module choices for existing applications.
Sidebar navigation presents declared menu groups as disclosures and their
declared modules as nested choices; it must not infer workflows from menu order
or module identity. The current module context may be shown outside the
sidebar, but it is not a second module-selection surface.

This directive is presentation-only. It does not change module ids, submitted
values, routes for loaded modules, execution, outputs, or reattachment. Any
future sequential navigation requires an explicit application-neutral workflow
contract and the shared-core extension gate below.

## Shared-core extension gate

Before changing UI2 core, write a shared-gap report that states:

1. the application symptom and the smallest application-level attempt;
2. an application-neutral reproduction fixture;
3. why existing view metadata and declared output contracts cannot express it;
4. the proposed generic schema or runtime contract;
5. an opted-in consumer, a non-opted-in control, compatibility impact, and
   rollback path; and
6. the explicit owner approval for the GenApp-core change.

Stop and ask for direction when any of those items is absent. A screenshot,
one module, or one SASSIE scientific term is not evidence of a shared gap.

Core code is rejected if it branches on a module id or output id, contains an
application-specific scientific role, or consumes an undeclared `ui2_*`
producer key. A generic capability must be describable without naming the
application that motivated it.

## Plotly contract

Drivers provide scientific data, titles, axis names/units, scale types,
uncertainty, series identity, and required subplot relationships. They do not
provide fixed size, margins, fonts, colors, line widths, marker sizes, legend
coordinates, toolbar configuration, or renderer-specific annotation placement.

An application view may map a scientific series identity to a small, documented
UI2 presentation token. UI2 styles tokens such as `primary`, `reference`,
`context`, `experimental`, `uncertainty`, and `residual`; it never styles a
scientific role by name. The mapping is presentation-only and must not change
the plot's scientific values or identity.

An application that installs a local Plotly Chart Editor may opt all UI2 plots
into that generic capability with `ui2_plotly_chart_editor`,
`ui2_plotly_chart_editor_url`, and `ui2_plotly_chart_editor_target` directives.
UI2 owns the standard modebar button and applies the capability to static,
dynamic, live, completed, and reattached figures. A legacy figure-level
`config.genapp_chart_editor` declaration remains a compatibility override and
may explicitly disable the application default. Drivers must not duplicate the
application default or supply standard toolbar layout.

The standard toolbar is a neutral UI2 capability: it supplies responsive
rendering, scroll-wheel zoom, scale-2 PNG export, ordinary navigation controls,
and compatible hover/spike controls. It removes box/lasso selection and retired
Chart Studio controls. UI2, rather than an application driver, also owns its
contrast and keyboard access. It remains a single horizontal row; when a narrow
pane cannot show every control, that row scrolls horizontally instead of
wrapping into the figure. UI2 places every Plotly legend slot below the plot in
ordered horizontal rows and reserves the required bottom margin, so toolbar and
legend geometry never overlap scientific data. Every control has a mouse-hover
tooltip and accessible name. Keyboard focus reveals the toolbar, visibly marks
the focused control, and Enter or Space performs the same action as a mouse
click after initial rendering, relayout, resizing, and streamed updates.

Statistics and explanatory text belong in a declared caption or summary output
by default. An in-plot annotation requires a documented, view-declared generic
placement policy keyed by a named annotation; the driver must not send an
ad-hoc UI2 placement flag.

## NGL contract

A coordinate-frame event may contain `coordinates`, `atom_count`, `frame_id`,
an optional user-visible `label`, timestamp, and opaque metadata. UI2 may use
the identity and label but must not interpret application-specific metadata such
as acceptance counts, trials, or milestones.

Application metadata declares NGL capability and display defaults. Runtime
payloads provide scientific artifacts and availability, not camera, background,
opacity, color, or browser-memory lifecycle policy. UI2 determines whether a
completed snapshot retains compatible live frames from the same topology.

An application may opt into `ui2_plot_background_preference`. UI2 stores the
user's `match_panel` or `contrast_canvas` selection locally, resolves contrast
from computed theme surfaces, and rerenders cached figures without changing
producer data or saved output. The capability is generic and must not branch on
application, module, output, or scientific-role identifiers.

## Required verification

Every shared-core change requires:

- a neutral UI2 fixture with no SASSIE module names or output ids;
- behavior tests for opted-in and non-opted-in consumers, including dynamic
  output empty/populated/cleared/repopulated lifecycle where applicable;
- Plotly/NGL schema and source-boundary checks;
- generated-asset checks; and
- UI2 generation plus confirmation that HTML5 generation behavior is unchanged.

Do not use a migration-status registry, a permanent exception list, or a
plot-specific replay store to bypass these checks. Remove existing debt before
making a zero-exception gate mandatory.
