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

### Embedded application pages

A UI2-specific module override may declare an `embedded_page` object containing
a required `url` and an optional `title`. UI2 renders the same-origin page
directly in the module workspace instead of creating the ordinary Inputs,
Submit, and Outputs form. This is intended for protected application tools that
own their own request and response workflow and do not create GenApp jobs.

UI2 rejects cross-origin and malformed URLs, applies a no-referrer policy, and
sandboxes the page to same-origin form submission. The embedded endpoint remains
responsible for authentication, authorization, request-integrity protection,
cache policy, and restricting which origins may frame it. Applications that do
not declare `embedded_page` retain the ordinary module renderer. HTML5 behavior
is unchanged because the declaration belongs in a UI2 target override.

## External authentication policy

An application may advertise same-origin external identity providers through
`ui2_auth_providers_url`. A providers-only manifest remains additive: UI2 keeps
the legacy Login and Register paths and displays valid external providers as
alternatives.

An application may explicitly return `authentication_mode: "external_only"`
with `registration: "jit"` and at least one valid same-origin provider. UI2 then
replaces public Login and Register controls with the external provider action
and omits password-change controls. HTTP 404 means the runtime option is
disabled and preserves legacy behavior. A malformed explicit policy or a
non-404 manifest failure fails closed and must not expose password controls.

An external-only manifest may also provide a bounded plain-text
`warning_banner`. UI2 displays it on the sign-in splash before the provider
action. The field is ignored for providers-only, legacy, unavailable, malformed,
or disabled policies. The application owns the text; UI2 inserts it as text,
not HTML. Applications that do not supply the field retain their existing
presentation.

An external-only manifest may declare `managed_account_fields: ["email"]`
when its identity provider owns the email attribute and the application does
not permit local email changes. UI2 then omits the email-change controller and
all fields repeated by that controller from Settings, and explains that email
is managed by the external identity provider. The accepted vocabulary is
bounded; unsupported values are ignored. This field is ignored for additive
providers-only, legacy, unavailable, malformed, or disabled policies. Omitting
it preserves the existing email settings, including for other external-only
applications.

While the session is logged out, the sign-in splash and mandatory Login and
Register overlays use an opaque theme surface that fully obscures the mounted
application shell. Ordinary dialogs opened after authentication retain the
standard translucent backdrop. This presentation rule does not alter session
state, provider selection, or authorization behavior.

UI presentation is not an authorization boundary. Applications using
external-only mode must opt generated password login, password registration,
password-change, and any declared managed-field handlers into
`external_auth_policy` and provide the application-owned
`ui2/auth/policy.php` enforcement hook. Applications without that directive
generate the existing handlers unchanged. The application-side hook remains
authoritative and must reject direct attempts to change a managed field;
hiding it in UI2 is not sufficient. Identity-provider protocols, account
linking, account creation, privileges, storage, and deployment configuration
remain application-owned.

An application using `external_auth_policy` may additionally implement
`ga_external_auth_enforce_session(operation, window)` in its application-owned
policy hook. Generated authenticated request paths call the function only when
it exists. The application decides eligibility and may clear its session and
return an authorization failure; GenApp does not interpret provider identity,
account status, or application-specific block records. Applications without
the directive, and opted-in applications that omit the optional function,
retain their current behavior. UI2 clears its local authenticated state when a
session-status request returns HTTP 401 or 403.

The optional application hook
`ga_external_auth_user_management_html(html)` may prepend or append a protected
application-owned administrator link to the generic User management report.
The returned content is presentation only; the target endpoint must perform
its own session, administrator, request-integrity, and authorization checks.

An external-only manifest may declare a same-origin `logout_url`. UI2 first
completes the existing local GenApp logout and then navigates to that endpoint,
including only the bounded UI2 window id. The application endpoint owns the
provider-specific logout protocol, one-use state, and return routing. The URL
is ignored for legacy, additive providers-only, unavailable, malformed, or
non-opted-in policies; omitted declarations retain local-only logout.

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
by default. An in-plot annotation requires a stable producer-supplied `name`
and a view-declared generic placement policy. A view may map that opaque name
through `plotPresentation.annotationPlacement` to `above_plot`; UI2 then stacks
the selected annotations in a measured lane above the plotting area and
recomputes its top margin after responsive resizing. The driver supplies the
annotation identity and text, never UI2 geometry or an ad-hoc placement flag.
Unselected and unnamed annotations retain their declared Plotly behavior.

For annotations selected as `above_plot`, UI2 supplies complete paper-coordinate
placement and disables arrows before the first Plotly render or update. The
subsequent measured pass adjusts the responsive lane and margin without using
scientific axes for placement. Preparation must not mutate the saved figure;
unnamed and unselected annotations retain their declared behavior. Application
preview tools use the same preparation helper before rendering.

An application view may opt a Plotly result group into
`plotPresentation.axisTitleOverflow: "wrap"`. UI2 measures plain axis titles
against their rendered axis span and font, wraps only at word boundaries and
approved separators, and recomputes after responsive resize. The producer
continues to supply the unmodified semantic title; it must not insert responsive
`<br>` markup. Rich titles with explicit markup and non-opted-in figures retain
their declared behavior.


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

After the final paper and plot backgrounds are selected, the shared UI2 surface
resolver derives neutral readable colors from those actual surfaces. It owns
figure and annotation text, axes and ticks, grids and zero lines, legend
surface/text (including group headings), hover labels, and modebar presentation.
Legend entry and group-heading colors resolve from each legend's own final
background, preserving authored font size and family, including numbered
legends. Normal UI2 and preview
tools must use the same resolver; a surrounding theme name or separate
light/dark shortcut must not override the final-surface result.

An application profile may opt into generic `light_surface` and
`dark_surface` palette overlays. They are partial overrides of its base palette
and are selected from the resolved final plotting surface, never from an
application theme name, module id, output id, trace name, or scientific role.
Missing or unclassifiable surfaces retain the base palette. Normal UI2 and
preview tools must call the same inheritance and surface-palette evaluator.

### Repeated-family presentation

Repeated-family differentiation follows the same neutral boundary. The
producer retains one scientific role and may provide an opaque stable group
identity. A view may select a generic group palette. Core may map that identity
to color, dash, marker, and marker-pattern slots, but must not interpret the
identity, inspect module names, or change data. UI2 and authoring previews must
call the same shared evaluator.

## Installed build provenance

The generic installed-tracking opt-in and receipt schema are governed by
`Release-Version-Policy.md`; the demonstrated neutral gap and approved core
scope are in `UI2-Installed-Version-Shared-Gap-Report.md`. UI2 must fetch the
served manifest on opening Version details and must not replace an opted-in
installed identity with older embedded checkout metadata. Generation records
its own generator and the application build evidence, preserves the existing
instance stack, and leaves publication to the application's verified publisher.
No component-specific logic, host discovery or scientific imports belong here.

For applications without installed tracking, the existing optional
`.local/source_revision_metadata.json` / `source_revision_metadata_file`
validation and embedded schema-1 overlay remain compatible. Opted-in installed
tracking ignores this retired collector file. Both forms describe provenance;
neither changes release versions, dates, tags, URLs or compatibility.

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

## Native tool views

The approved neutral gap report is `UI2-Admin-Tools-Shared-Gap-Report.md`.
Applications may opt into `layout: "tool"` for operational forms and reports.
This layout uses ordinary native field/output rendering and existing submission,
transport, polling, cancellation and reattachment. It omits canonical section
headings, shortcuts and empty-input messages. It must not branch on module ids.

`submit_label` selects the action caption; enabled `noreset` omits Reset.
For tool views only, enabled `autosubmit` schedules submission only when every
input is hidden or absent, and never during reattachment. Visible controls,
including repair checkboxes, must require explicit submission.
Optional `tool.stopLabel` exposes cancellation of the current tool's owned UUID.
Track ownership by module and login, prevent concurrent duplicate submission,
and use the existing job cancellation endpoint and confirmation. Navigation may
resume an owned active tool without launching another job. Browser memory is
only a navigation cache; normal saved-job reattachment remains authoritative.

### Deployment menu visibility

`ui2_hidden_menu_items` is an optional array of exact menu module IDs in
application directives. UI2 generation validates the array against the effective
(target-specific) menu and serializes it as JSON into the navigation map.
Listed module entries are skipped when that map is assembled. An absent or empty
array preserves existing map registration. Invalid values and unknown IDs fail
UI2 generation; duplicate IDs are harmless. Base and target directive arrays
retain the existing additive merge behavior. HTML5 ignores this UI2 option.

This is navigation presentation, not authorization or module disabling. Module
metadata, backend generation, direct module routes, saved jobs, restrictions,
and authentication remain unchanged. Empty groups are hidden by the existing
UI2 renderer. Applications must retain endpoint authorization independently.
No provider, deployment hostname, or application module ID is hard-coded in
GenApp. See `UI2-Menu-Visibility-Shared-Gap-Report.md` (#312).

## 3D scene surface contrast

The shared final-surface resolver applies to declared `scene` and numbered
scenes as well as Cartesian axes. Each scene's explicit or template background
falls back to the selected plotting canvas; each axis plane falls back to the
scene background. Alpha compositing and `showbackground` determine the actual
surface used for tick/title text, ticks, axis lines, grids, and zero lines.
3D grids and axis lines use the stronger neutral zero-line token so they remain
discernible under rotation and perspective. Existing font sizes/families,
scientific labels/units, coordinates, axis ranges/types, visibility flags,
camera, aspect mode, templates, and saved outputs remain unchanged.

Ordinary UI2 and application previews use the same `GenAppPlotlySurface.apply`
pass on detached display layouts. Chart Editor receives that displayed scene
through its existing handoff. Figures without scenes retain existing behavior;
no new application option or producer styling is needed. The approved evidence
and rollback are in `UI2-3D-Scene-Contrast-Shared-Gap-Report.md` (#318).

## Responsive independent subplot spacing

A view may select `plotPresentation.subplotSpacing: "avoid-overlap"` for
independent Cartesian panels arranged in an explicit one-column `grid.subplots`.
The shared `GenAppPlotlyLayout.applySubplotSpacing` helper measures rendered
bottom-axis titles and tick labels, reserves an inter-panel lane, and rebuilds
detached display y domains using source panel-height ratios (equal when absent).
It runs after legend, annotation and title fitting and again after resize or
redraw in UI2 and the application preview. No application identifiers or
scientific-role interpretation enter the helper.

Source figures, values, uncertainties, explicit axis ranges, zoom, titles and
identities remain unchanged; ordinary autorange padding may follow pixel span; saved-output reattachment recomputes presentation. Missing or
invalid selection, single panels, shared/overlaid axes, top x axes, non-column
grids, and containers too short for 24-pixel panels remain unchanged. This
capability does not lay out arbitrary inset figures or replace declared
scientific subplot relationships. Removing the selection restores ordinary
source layout on the next render. HTML5 behavior is unchanged.

The approved evidence and scope are in
`UI2-Subplot-Spacing-Shared-Gap-Report.md` (#321).


### Wrapped-title automatic margins (#322)

The existing axis-title wrap opt-in supplies a display-only automatic margin
only for titles that actually wrap. Explicit axis/template settings remain
authoritative. The shared helper releases its defaults when wrapping ends or
the opt-in is removed, without mutating saved figures or scientific arrays.
The neutral reproduction, compatibility details and validation requirements are
in `doc/UI2-Axis-Title-Overflow-Shared-Gap-Report.md`.

## Global application workspaces

Application-wide workspaces use the optional, same-origin
`ui2_global_workspaces_url` manifest described in
`UI2-Global-Workspace-Shared-Gap-Report.md`. Shared UI2 validates and renders
the bounded manifest but must not branch on an application or workspace id.
Context handoffs use bounded, one-use browser session storage; they never carry
credentials or grant server authority. The application owns authorization,
the destination, durable data, and feature opt-in.

An entry may select `presentation: "companion_window"`. UI2 opens a named
secondary browsing context through the existing authenticated UI2 session
handoff, stores the initial one-use context in that target's session storage,
and keeps the originating module mounted. Re-selecting the same workspace in
the same project focuses the existing companion and sends a fresh bounded
context snapshot over a same-origin message carrying a random per-window
channel identity. Applications validate and persist those snapshots; shared
UI2 does not interpret them. The default remains `same_tab`, and browsers may
honor a user's preference to present a requested window as a tab.

Because workspace authorization or availability may depend on the active
project, shared UI2 refetches the optional manifest after successful project
selection and project creation as well as during normal session refresh. This
is an application-neutral lifecycle rule: applications without the directive
perform no workspace request, and UI2 still does not interpret workspace ids or
application-specific meaning.


## Automatic tick-label collision protection (#334)

All visible Cartesian x/y axes receive shared display-only collision fitting,
including numbered, inferred, reversed, overlaid, linear, logarithmic, date and
category axes. `axisTickDensity` remains accepted for compatibility but is no
longer required. UI2 and the Plot Presentation Lab call the same
`GenAppPlotlyLayout.applyTickDensity` helper after geometry fitting.

The helper measures rendered label rectangles and suppresses a deterministic
subset of colliding labels with a four-CSS-pixel separation. Retained label text
and native tick/grid positions are preserved, including explicit/custom ticks
and intentionally blank labels. Logarithmic decade labels receive priority.
Every fit restores the preceding native tick specification before measuring;
labels return as the available space or range changes. Final bounds are checked
again after array-mode rendering, with monotonically decreasing visible labels.

Rendering, updates, zoom/pan/reset, resize and saved-output reconstruction refit
the labels. Fitting coalesces requests, retains the latest pending range/style
change, and ignores its own relayout events. A replacement figure supersedes
cached display state. PNG export and Chart Editor handoff await the fit; PNGs
use the displayed dimensions at scale two. The editor receives the fitted
layout through the existing handoff; subsequent editor edits belong to that
editor, not this UI2 lifecycle.

This is a change to label visibility, including explicitly authored labels;
it does not change scientific arrays, uncertainty, names, units, ranges, scale
types, hover precision, or saved final output. It applies to Cartesian axes,
not 3D scenes or polar axes. Geometry is owned by UI2, not YAML or producers.
HTML5 behavior is unchanged. No module-specific branches or opt-ins are needed.
See `doc/UI2-Tick-Density-Shared-Gap-Report.md` for evidence and acceptance.

### Mandatory acceptance check for every new or updated SASSIE plot

Every new or updated SASSIE-web plot must demonstrate that visible x- and
y-axis labels do not overlap before it is accepted. This is a SASSIE-wide
requirement, including all Cartesian subplots and secondary axes; it does not
require a module opt-in. Any observed overlap fails acceptance and blocks
handoff until corrected through the shared presentation layer.

Check rendered labels at representative narrow and wide supported sizes, in
normal and expanded/restore layouts, after zoom/pan/reset and resize, during
updates where applicable, at completion, and after fresh-window reattachment.
Check PNG export and the initial Chart Editor handoff where available. Include
axis titles as well as tick labels in visual inspection. Use rendered label
bounds to check tick-label collisions; passing source or unit checks alone is
insufficient. Record the exercised sizes, states and results in the acceptance
evidence; identify genuinely inapplicable states explicitly. An untested
required state is not a pass. Scientific values, units and saved payloads must
remain unchanged.
