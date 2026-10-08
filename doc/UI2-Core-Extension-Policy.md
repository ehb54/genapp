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

## Deployment source provenance

An application may opt into an ignored, application-local source revision
metadata file at `.local/source_revision_metadata.json`, or declare another
relative location through `source_revision_metadata_file`. Generation validates
and embeds schema version 1 in the application map. UI2 may use matching
`component_id` values to overlay exact deployment revisions onto an
application-owned release manifest. GenApp does not discover application
repositories, assign releases, interpret compatibility, or write the metadata.
Missing metadata remains an explicit null value for applications that do not
opt in; an opted-in missing or invalid file is a generation error.

The application owns component selection and ordering. The metadata contains
deployment provenance only and must not replace version, release stage, date,
tag, or release URL fields.

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
