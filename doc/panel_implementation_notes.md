# Panel Implementation Notes

These notes summarize a read-only review of the GenApp panel/layout prototype from the `php7designer` branch and the GenApp wiki layout documentation.

Primary references:

- <https://github.com/ehb54/genapp/blob/php7designer/bin/layoutize.pl>
- <https://github.com/ehb54/genapp/tree/php7designer/etc/layout_templates>
- <https://genapp.rocks/wiki/wiki/docs_layout>
- <https://genapp.rocks/wiki/wiki/docs_layout_generation>
- <https://genapp.rocks/wiki/wiki/docs_layout_integration_notes>

No source files were modified during the review.

## What the Prototype Does

The layout system adds a new top-level `panels` structure to module JSON and a per-field `layout` object. Conceptually:

```json
{
  "panels": [
    { "root": { "size": ["auto", [1, 1]], "gap": "5px" } },
    { "body": { "parent": "root", "location": ["next", "full"] } }
  ],
  "fields": [
    {
      "id": "some_field",
      "role": "input",
      "type": "text",
      "layout": { "parent": "body", "location": ["next", "next"] }
    }
  ]
}
```

The intended pipeline appears to be:

```text
module.json -> Perl layout expansion in ga_layout.pm -> generated layout JSON via __layout__ -> browser-side HTML construction in layout.js
```

`layoutize.pl` is a migration helper. It takes a layout template from `$GENAPP/etc/layout_templates`, applies the template's `panels`, and assigns each existing module field a default `layout` based on field `role`, writing `modules/<module>.new`.

## Layout Templates

The `php7designer/etc/layout_templates` directory currently contains exactly two migration templates:

- `headerbodyfooter`
- `leftright`

`layoutize.pl` reads templates from `$GENAPP/etc/layout_templates`, lists them as valid `template-name` choices, validates that the chosen template has both `panels` and `fields`, then applies it to an existing module file.

### `headerbodyfooter`

Creates:

- `root`
- `header`
- `body`
- `footer`

Maps both `input` and `output` fields into `body`.

### `leftright`

Creates:

- `root`
- `header`
- `body`
- `footer`
- `leftpanel`
- `rightpanel`

Maps `input` fields to `leftpanel` and `output` fields to `rightpanel`.

## Important Shape

The design is CSS Grid oriented: panels and fields get generated grid-row/grid-column metadata.

The layout docs are still explicitly marked as work in progress. The TODOs are significant: repeaters, more field types, plotting, reattach, bootstrap/theme behavior, and button placement are not fully settled.

These templates are role-based migration defaults, not detailed per-field layouts. They get a non-layout module into the new `panels`/`layout` schema quickly, but meaningful visual design still requires manual refinement after `modules/<module>.new` is generated.

## Potential Issues Noted

`layoutize.pl` is intentionally mechanical and lossy. It decodes and re-encodes module JSON, so comments and key order are lost. It says this explicitly, but that matters for mature hand-maintained module files.

There is a small typo/bug in an error message in `layoutize.pl`: it says `$f->{roll}` where it appears to mean `$f->{role}`. That only affects diagnostics, but it would make a bad template/module mismatch more confusing.

`layoutize.pl` only maps layouts by `role`, so it cannot distinguish special fields like headers, buttons, plot outputs, or file controls unless the template/model is extended. It is a starter migration tool, not a layout designer.

In `ga_layout.pm`, this line looks like a likely Perl operator bug:

```perl
die "$0: add_field() unknown type '$type'\n" if $type != /^(label|data|repeats)$/;
```

That should almost certainly be a string regex test, not numeric `!=`, for example:

```perl
die "$0: add_field() unknown type '$type'\n" if $type !~ /^(label|data|repeats)$/;
```

In `layout.js`, there is a suspicious reference in `ga.layout.rhtml()`:

```js
ga.layout.panel[pos].ralign
```

The nearby code suggests it probably meant the current field entry, not `ga.layout.panel[pos]`.

## Local Repo State

The current local checkout does not appear to contain the layout prototype files yet:

- no local `etc/layout_templates`
- no local `bin/layoutize.pl`
- no local `etc/perl/ga_layout.pm`
- no local `languages/html5/js/layout.js` layout implementation

So these notes describe branch/prototype behavior, not current local checkout behavior.

## Takeaway

This is a sensible migration path: keep old modules valid, introduce optional `panels` and `layout`, provide bulk layoutization helpers, and move complex placement to a dedicated layout expansion/rendering layer.

The biggest care points are preserving hand-authored module JSON, validating layouts early with useful diagnostics, and deciding how special GenApp concepts like submit/reset/progress/messages/repeaters/plots participate in the same layout model.

## Runtime-Owned Layout Objects

GenApp injects several runtime-owned objects even when they are not authored as ordinary module fields:

- `b_submit`
- `b_reset`
- `${moduleid}_progress`
- `${moduleid}_output_airavata`
- `${moduleid}_output_msgs`
- `${moduleid}_output_textarea`

These should be treated as real layout objects in the designer, but marked as runtime-owned so users can distinguish GenApp infrastructure from science-module fields.

The first deterministic default is:

```text
controls
  authored controls/plots first
  submit/reset row
  progress row
  airavata row
  messages row
  textarea row
```

Modules can override runtime placement with an optional top-level `runtime_layout` object. Keys may use generic runtime names or exact generated field ids:

```json
{
  "runtime_layout": {
    "submit": {
      "parent": "controls",
      "location": [8, 1],
      "label": "none",
      "data": [1, 1]
    },
    "reset": {
      "parent": "controls",
      "location": [8, 2],
      "label": "none",
      "data": [1, 2]
    },
    "progress": {
      "parent": "controls",
      "location": [9, 1],
      "label": "none",
      "data": [1, [1, 3]]
    },
    "messages": {
      "parent": "controls",
      "location": [11, 1],
      "label": "none",
      "data": [1, [1, 3]]
    },
    "textarea": {
      "parent": "controls",
      "location": [12, 1],
      "label": "none",
      "data": [1, [1, 3]]
    }
  }
}
```

`runtime_layout.panels` may also define additional panels needed only for runtime objects. The layout expander adds those panels if they do not already exist.

The designer should validate this layer by warning when a runtime-owned field references a missing parent or collides with another field in the same grid cell.

## Layout Designer Prototype

A first static browser prototype lives in `doc/layout_designer_prototype`.

The prototype is intentionally separate from the production `layout.js` and `dd.js` path. It provides a concrete interface for checking the desired designer workflow before making the branch designer authoritative:

- palette buttons for adding panel and field primitives
- a live nested-panel canvas
- drag/drop movement of fields between panels
- an inspector for selected panel/field layout properties
- exported template-shaped JSON with `panels`, role-based `fields`, and sample field layout assignments

This should be treated as a design surface, not yet as a production serializer. The next hardening step is a true round-trip check: load an existing module/template, render it, export without edits, and diff the resulting layout against the source.

## Meeting Transcript Comparison

The meeting transcript in `/Users/curtisj/genapp_panel_meeting.txt` strongly confirms the earlier code/wiki analysis.

The live discussion describes the same architecture: GenApp panel layout is JSON, built around top-level `panels` plus per-field `layout`, and the implementation target is CSS Grid. Emre explicitly describes the layout definitions as being processed to create CSS grid information, and clarifies that the syntax is GenApp's JSON schema rather than an external JavaScript layout standard.

The meeting reinforces that `docs_layout` is the canonical reference. Emre describes it as the definition sheet and says that when code and documentation disagree, the project needs to decide whether to fix the code or revise the spec. This matches the earlier observation that the docs represent the intended model, but the implementation/spec boundary is still work-in-progress enough that mismatches should be expected.

The transcript also confirms the role of `layoutize.pl` and `etc/layout_templates`: `layoutize.pl` takes a module plus a layout template, applies the template's panels, and produces a layout-adapted module file. The two initial templates are confirmed as:

- `leftright`
- `headerbodyfooter`

The meeting adds useful intent around those templates. They are not meant to fully design a module automatically. They are starter layouts: a way to get the correct panel structure into a module file before a developer hand-wires fields appropriately. This agrees with the earlier conclusion that they are role-based migration defaults, not full per-field designers.

One new emphasis from the transcript is the desire for one or more SASSIE-style layout templates. That was not explicit in the initial code/wiki review and now looks like a practical next step: start from the generic templates, then define templates that reflect common Zazzie/SASSIE module layout patterns.

The meeting also clarifies that panels form a tree. `root` is the base, additional panels default to `root` unless explicitly parented elsewhere, and fields can be assigned to any panel. Emre describes this as arbitrarily nested panels and as a mini GenApp field set inside a panel. This fits the `parent` model in the layout docs and `ga_layout.pm`.

Additional future work raised in the meeting:

- collect working example panel setups from Emre
- consolidate docs/examples into one area for project and agent orientation
- consider molecular renderer hooks beyond JSmol
- use UI/browser regression testing to open generated apps, click buttons, resize, and validate behavior

Compared to the prior analysis, the transcript does not require a major correction. It sharpens the priority: the core technical model is right, and the next useful work is likely documentation/examples and a migration path for real SASSIE/Zazzie modules rather than immediately polishing every edge of the generic layout engine.

## Zazzie Module Audit

A read-only audit of `/Users/curtisj/git_working_copies/genapp_zazzie/menu.json` and the matching files under `/Users/curtisj/git_working_copies/genapp_zazzie/modules` found 30 active menu modules with local Zazzie module JSON files. Admin/system entries in `menu.json` point back to framework/system modules and do not have local Zazzie module files.

All 30 active local science-facing modules are old-style non-panel modules: none has top-level `panels`.

Every active local module follows the same coarse role sequence:

```text
input fields -> output fields
```

No active local module interleaves input and output roles. This makes a single starter `legacy_layout` plausible, but only as a conservative baseline rather than a finished visual design.

The existing legacy layout is encoded informally through:

- field order
- `label` fields used as section headers
- `prehline` and `posthline`
- `norow`
- `repeat` and `repeater`
- output ordering, usually progress/html first, then plots, molecular viewers, reports, or textareas

Several modules are especially repeater-heavy and should be treated as high-risk for visual migration:

- `multi_component_analysis`
- `build_utilities`
- `extract_utilities`
- simulation modules such as `torsion_angle_monte_carlo`, `complex_monte_carlo`, `energy_minimization`, `openmm`, and related Monte Carlo/MD tools

Five active modules already contain per-field `layout` fragments, even though they do not define top-level `panels`:

- `chi_square_filter`
- `contrast_calculator`
- `contrast_variation_analysis`
- `multi_component_analysis`
- `rg_center_of_mass_distance_calculator`

These fragments mostly use:

```json
{ "location": ["same", "next"] }
```

They appear to be early attempts to align repeated/tabular fields horizontally. A migration helper must preserve or consciously merge these fragments. The prototype `layoutize.pl` currently assigns each field's `layout` from the selected template role, so using it unchanged would overwrite these existing field-level layout hints.

## Outer Frame vs Module Interior

Screenshots of the running SASSIE-web interface clarify the boundary for panel work. The page chrome is outside the module JSON layout work:

- top application/header area, including `SASSIE-web`, login/help/icons
- menu/category navigation and horizontal module tabs
- right-side vertical `DOCS` and `FEEDBACK` tabs
- footer/funding text
- outer dark theme/body frame

The panel work should stay inside the generated module content area: the region currently occupied by the selected module's form, labels, controls, submit/reset buttons, progress widgets, plots, molecular viewers, and output reports.

This means the first `legacy_layout` should mimic the existing module interior rather than the whole page shell. A conservative candidate shape is:

```text
module_root
  input_panel
  controls_panel
  output_panel
```

An even safer first migration shape is:

```text
module_root
  body
```

with input fields, submit/reset, progress, and outputs stacked in the same order they are today.

The screenshots also show why the existing `leftright` template is risky as a universal default. The current visual design has a field-level two-column pattern: labels on the left, controls wide on the right. It is not a two-panel design where all input belongs in one large left panel and all output belongs in one large right panel. A permanent left/right module split would likely fight the existing SASSIE-web layout, especially for repeaters, large plots, molecular viewers, and reports.

Recommended migration posture:

1. Leave the outer SASSIE-web frame alone.
2. Treat panels as an internal module layout mechanism.
3. Start with a conservative `legacy_layout` that preserves existing module interior behavior.
4. Use visual/browser regression checks before attempting richer SASSIE-style internal panel designs.
5. Refine high-value modules individually after the baseline migration is proven.

## Proposed Starter `legacy_layout`

The first migration pass should use a deliberately conservative `legacy_layout`. Its goal is compatibility, not final visual design.

Proposed panel shape:

```text
root
  header
  body
    inputpanel
    msgspanel
    resultpanel
  footer
```

This reflects what the active SASSIE/Zazzie modules have in common:

```text
module header
input fields
submit/reset controls
progress/messages
outputs
```

It also stays inside the existing SASSIE-web frame, leaving the app header, menu tabs, docs/feedback tabs, theme shell, and footer untouched.

Initial general mapping rules:

- `module_header` label -> `header`
- all existing `role: input` fields -> `inputpanel`
- `role: output`, `type: progress` -> `msgspanel`
- `role: output`, status/progress HTML such as `progress_html` -> `msgspanel`
- all other `role: output` fields -> `resultpanel`

The first live build test showed that the `php7designer` html5 runtime injects its own `controls` panel for generated `b_submit`, `b_reset`, and status spans. Therefore the starter `legacy_layout` should not define an empty `buttonpanel`; generated controls are runtime-owned.

The migration should preserve original field order within each panel. Legacy modules already use order, labels, `prehline`, `posthline`, `repeat`, and `repeater` as part of the visual structure.

Important safety rule: do not overwrite existing per-field `layout` fragments. Some SASSIE modules already have hints such as:

```json
"layout": { "location": ["same", "next"] }
```

The migration should merge in a default `parent` only when missing, while preserving existing layout keys:

```json
"layout": {
  "parent": "inputpanel",
  "location": ["same", "next"]
}
```

The first pass should not try to infer advanced input panels, molecular viewer panels, plot grids, module-specific grouping, left/right redesigns, repeater sub-layouts, or polished placement of plots/reports/viewers. Those should be module-specific refinements after the panelized baseline is proven.

The intended meaning of `legacy_layout` is:

```text
Render the existing SASSIE module inside the panel system with minimal behavioral and visual disruption.
```

It is not intended to be the final SASSIE interface design.

## Zazzie Build Environment Check

The deployed SASSIE/Zazzie build path is not the same as the local GenApp checkout inspected at the start of this work.

On `zazzie.genapp.rocks` / `zazzie`, the user shell has:

```text
alias ga='pushd . ; cd /opt/genapp/sassie3 ; genapp ; popd'
```

The host `/usr/local/bin/genapp` is a wrapper. When run from `/opt/genapp/sassie3`, it executes GenApp inside the `zazzie3` Docker container:

```text
docker exec -it zazzie3 sh -c ". /etc/profile && cd /opt/genapp/sassie3 && genapp"
```

Inside that container:

```text
GENAPP=/src/genapp
genapp=/src/genapp/bin/genapp
/src/genapp branch: php7designer
/src/genapp commit: 2ac401c
```

The containerized GenApp tree includes the panel-era files that the local checkout did not originally have:

```text
/src/genapp/bin/ga_layout.pl
/src/genapp/bin/layoutize.pl
/src/genapp/etc/perl/ga_layout.pm
/src/genapp/languages/html5/js/layout.js
/src/genapp/etc/layout_templates/headerbodyfooter
/src/genapp/etc/layout_templates/leftright
```

This changes the earlier risk assessment. The local GenApp checkout appears to be a different branch or older state, so it was missing `/etc/layout_templates` and the panel renderer/runtime pieces. The actual `ga` build for `/opt/genapp/sassie3` appears to use the `php7designer` GenApp implementation inside the `zazzie3` container.

Practical implication: for local tool hardening, `layoutize_safe.pl` and `legacy_layout` are still useful as controlled migration helpers. For deployed Zazzie builds, we should test panelized modules against the containerized `php7designer` runtime rather than assuming the local checkout represents production behavior.

Remote repository state observed for `/opt/genapp/sassie3`:

```text
origin: git@github.com:ehb54/zazzie.git
branch: main
commit: 7ecc47b
```

There are existing dirty/untracked files in that deployed app tree. They should be treated as unrelated unless the user asks to clean or inspect them.

## First Pilot: `data_interpolation`

`data_interpolation` is a good first pilot because it is active in `menu.json`, has no repeaters, has a small input surface, and has only progress fields plus one Plotly output.

The local safe layoutizer generated the expected assignments:

```text
module_header     -> header
7 ordinary inputs -> inputpanel
progress_output   -> msgspanel
progress_html     -> msgspanel
lineplot          -> resultpanel
```

The deployed `/opt/genapp/sassie3/modules/data_interpolation.json` matched the local `genapp_zazzie` copy before testing. A backup was created on the server:

```text
/opt/genapp/sassie3/modules/data_interpolation.json.prepanel_20260514_1435
```

After installing the panelized candidate, the containerized build succeeded:

```text
docker exec zazzie3 sh -lc "cd /opt/genapp/sassie3 && genapp"
```

The generated file `output/html5/ajax/tools/data_interpolation.html` contains `ga.layout.panel` data and field layout assignments, confirming that the deployed `php7designer` runtime consumed the panelized module JSON. It also showed that GenApp adds a runtime `controls` panel containing generated `b_submit`, `b_reset`, and status/message spans. This is why the starter `legacy_layout` was revised to remove the previously proposed empty `buttonpanel`.

The second build with the revised `legacy_layout` also succeeded. The generated layout data now contains the starter panels plus GenApp's injected `controls` panel, with no `buttonpanel`.

One deployment detail remains to clarify: the container build regenerates `/opt/genapp/sassie3/output/html5/...`. A direct check inside the container did not find `/var/www/html/ajax/tools/data_interpolation.html`, and `https://zazzie.genapp.rocks/ajax/tools/data_interpolation.html` returned HTTP 404. The live application may serve through another route, mount, copy step, or authenticated path. The panel generator test is positive, but browser verification of the live page is still a separate step.

## Header Alignment Note

For SASSIE/Zazzie module pages, header/title labels (the top `module_header` section rendered in panel `header`) should be left-justified to match existing UI conventions. Centered header panel alignment was visually inconsistent with legacy modules such as `align`.

Practical rule for migrations:

```text
panel header align => left
```

If a module was panelized with `header.align = center`, patch that module to `left` as part of migration cleanup.
