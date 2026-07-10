# UI2 Design Plan

Living design plan for the GenApp `ui2` target.

This document is intended to accumulate decisions, constraints, open questions,
and phased implementation direction as UI2 evolves. It complements the
read-only audits and issue discussion; it is the working place to grow the
design intentionally rather than re-deciding the same tradeoffs in scattered
threads.

Related discussion:

- issue 41: React/shadcn versus scientific layout responsibilities
- `doc/UI2-Renderer-ROA.md`
- `doc/UI2-Runtime-Contract-ROA.md`
- `doc/UI2-Legacy-Guardrails-ROA.md`
- `doc/GenApp-Architecture-Audit.md`

## Status

Active implementation plan.

Current scope decision:

- UI2 will evolve at its existing `/sassie3/ui2` location.
- UI2 uses one fixed workbench layout during the current exploration phase.
- User-selectable layouts are postponed.
- Limited font and color preferences may later be exposed through themes, as
  they are in legacy.
- Monomer Monte Carlo is the first React/shadcn vertical slice because it runs
  quickly while exercising conditional inputs, progress, Plotly, and NGL.

Nothing in this document changes GenApp behavior by itself. It records the
current intended direction and should be updated as experiments or decisions
land.

## Problem Statement

The current UI2 renderer is functionally serviceable but structurally linear.
For most modules:

- inputs render as one long sequential form
- outputs render below the form in output order
- large input sections push results far down the page
- large result sets stack vertically without meaningful sizing or grouping
- the user has to scroll through layout rather than work within a workspace

This becomes more painful because the application already has a substantial and
varied module surface:

- 32 current scientific modules
- short, medium, and long input forms
- short, medium, and long result sets
- mixed result modalities including Plotly, NGL, images, HTML, files, logs, and
  progress indicators

The core design need is not just "better styling." It is a way to express
scientific workspace structure while preserving GenApp semantics.

## Current Working Conclusion

React and shadcn are useful implementation tools, but they are not the design
solution by themselves.

React can give UI2:

- a maintainable component model
- better state management for field visibility, validation, and results refresh
- cleaner separation between input and results workspaces
- safer lifecycle behavior for Plotly and NGL panels
- a path away from a single large renderer file

shadcn can give UI2:

- polished accessible primitives
- tabs, accordions, scroll areas, cards, resizable panes, sidebars, and dialog
  patterns
- open-code components we can adapt inside GenApp

Neither React nor shadcn decides scientific layout priorities for us.

The missing design layer is a presentation-only `views` model that can describe
input grouping, output grouping, prominence, placement, and default workspace
behavior without changing scientific meaning or runtime contracts.

## Goals

- Preserve the existing GenApp scientific and runtime contract.
- Preserve html5 legacy target behavior unless legacy changes are explicitly
  requested.
- Make UI2 feel like a scientific workbench instead of a long generated form.
- Support both small utility modules and large analysis modules with the same
  underlying design system.
- Keep presentation metadata optional so modules without `views` still render.
- Reuse a small number of strong layout archetypes instead of inventing 32
  separate designs.

## Non-Goals

- Redefining module semantics
- Changing executable JSON contracts
- Introducing a second hand-maintained scientific module definition tree
- Making `views` required for ordinary generation
- Replacing Plotly, NGL, or existing output producers
- Altering html5 output to match UI2 presentation choices

## Constraints

- `views` metadata must remain presentation-only.
- Missing `views` metadata must fall back to a safe default renderer.
- UI2 should be able to consume the same expanded GenApp runtime model as other
  targets.
- Layout improvements must not silently break job reattach, output replay, or
  existing runtime-owned controls.
- Scientific correctness and reproducibility are more important than reducing
  visible complexity through hidden behavior.

## Design Principles

### 1. Separate semantics from presentation

Module JSON remains the scientific and execution source of truth. UI2 layout
metadata may organize, emphasize, or collapse fields and results, but it should
not redefine their meaning.

### 2. Prefer workspaces over pages

The user experience should center on a working surface with stable areas for:

- module context
- input navigation and editing
- run actions and status
- result inspection

The design should reduce whole-page scrolling as the default interaction model.

### 3. Prioritize results by role

Not all outputs deserve equal visual weight. A primary structure viewer or
plot should not compete with plain text logs or secondary files for attention.

### 4. Preserve a strong default path

UI2 still needs a default layout for modules that have no curated view
metadata. The fallback should be reliable, predictable, and better than the
current pure linear presentation.

### 5. Optimize for repeated patterns

The module catalog is broad, but the interaction patterns appear to cluster.
We should identify a small set of archetypes and map modules to them rather
than treating each module as a unique design problem.

## Candidate Layout Archetypes

These are starting categories, not final taxonomy.

### Compact Form + Results

Best for short input modules with modest outputs.

Characteristics:

- compact form area
- adjacent or quickly reachable results area
- minimal section chrome
- fast submit / rerun flow

### Sectioned Scientific Workbench

Best for medium-to-long forms with structured parameter groups.

Characteristics:

- section navigation
- grouped input panels
- advanced sections collapsed by default
- sticky action bar
- stable results pane

### Branching Utility Workflow

Best for modules where selected options materially alter the active set of
fields or workflow steps.

Characteristics:

- prominent branch selector
- only relevant controls shown at once
- repeated or matrix-like inputs rendered with more specialized affordances
- context-sensitive help and validation

### Results-First Studio

Best for modules with many rich outputs or visualization-heavy workflows.

Characteristics:

- primary result surface visible quickly
- supporting results grouped by type
- tabs or panes for plots, structures, images, files, and logs
- status and summary information pinned near the top

## Candidate `views` Responsibilities

The `views` model is expected to carry presentation metadata such as:

- selected archetype
- input section definitions
- section labels and ordering
- collapsed / expanded defaults
- advanced versus primary designation
- output grouping by role or type
- primary / secondary result emphasis
- pane sizing hints
- placement hints for action controls
- optional titles or summaries for grouped result regions

The `views` model should not:

- change field ids
- change output ids
- alter execution behavior
- override scientific defaults in a way that changes job meaning

## Early Shape For `views`

The exact schema remains open, but a likely direction is module-local,
presentation-only metadata that can be merged without disrupting existing
module contracts.

Illustrative shape:

```json
{
  "layout": "workbench",
  "inputSections": [
    {
      "id": "system",
      "label": "System",
      "fields": ["run_name", "pdbfile", "psffile", "outfile_prefix"]
    },
    {
      "id": "solvent",
      "label": "Solvent and Ions",
      "fields": ["build_solvation", "salt_conc", "padding", "positive_ion", "negative_ion"]
    },
    {
      "id": "advanced",
      "label": "Advanced",
      "collapsed": true
    }
  ],
  "results": [
    {
      "id": "viewer",
      "size": "primary"
    },
    {
      "id": "energy_plot",
      "size": "secondary"
    },
    {
      "id": "log",
      "group": "files_and_logs",
      "collapsed": true
    }
  ]
}
```

This example is intentionally illustrative. It records the level of intent we
likely need, not a finalized schema.

## Implementation Direction

Current expected direction:

1. Keep the expanded GenApp runtime model as the source of truth.
2. Add optional presentation metadata for UI2.
3. Build a renderer that consumes the expanded model plus `views` hints.
4. Use React for component composition and state management.
5. Use shadcn primitives where they strengthen the workbench interaction model.
6. Keep deployment/server runtime simple; avoid introducing unnecessary Node
   runtime requirements on the deployed application.

## Wish List and Exploration Requirements

These items are desired capabilities to explore. They are not yet approved
implementation decisions.

### 1. Stable UI2 Beside an Experimental React UI2

UI2 is now being exercised by other developers. Layout exploration needs a
place where incomplete or temporarily broken work does not disrupt their use of
the current UI2 site.

Desired Zazzie3 arrangement:

- current UI2 remains at `https://zazzie3.genapp.rocks/sassie3/ui2`
- experimental layout work is available at
  `https://zazzie3.genapp.rocks/sassie3/ui2-react`
- both sites share the same authenticated user space, projects, files, jobs,
  and relevant server-side runtime services
- experimental presentation changes cannot alter or break the current UI2
  assets
- moving between the two sites is transparent to a tester

The preferred developer experience is to continue compiling the `ui2` target
without creating a second scientific module definition tree. Whether one
generation can safely maintain both sites is an implementation question.

Likely separation of concerns:

- module definitions and expanded runtime semantics remain shared
- stable and experimental client assets need independently addressable output
  or deployment locations
- authentication, project storage, job state, and server APIs remain shared
- an explicit build/deployment profile may select the stable or experimental
  client without creating a new GenApp target language

The experiment should proceed under `ui2-react` only if that separation is
seamless, harmless, and transparent. If supporting two adjacent deployments
would introduce brittle generator branching, duplicated definitions, or user
space incompatibility, temporarily evolving the existing UI2 site remains an
acceptable fallback.

Questions to answer before implementation:

- Is `/sassie3/ui2` a generated output directory, a web-server route, a runtime
  selection, or some combination of these?
- Can one generated UI2 model feed two independent client bundles?
- Which browser-visible paths, cookies, API endpoints, and generated asset URLs
  currently assume `/ui2`?
- Can `/ui2-react` use the same login session and job/project namespace without
  weakening cookie or path isolation?
- What exact command promotes an experimental build to stable UI2?
- How do we prevent ordinary UI2 regeneration from overwriting the experimental
  site, or vice versa?

### 2. Tester Layout Options and User Preferences

During design exploration, testers should be able to compare layout ideas
without requiring a regeneration for every choice. Longer term, users may have
a layout chooser, a theme chooser, and at minimum a style chooser for personal
display preferences.

These choices should be treated as three distinct layers:

1. **Module view definition:** the author-provided scientific organization,
   including input groups, result roles, and safe defaults.
2. **Layout variant:** a tester or user choice among supported workspace
   arrangements, such as split panes, results-first, or sectioned form.
3. **Personal style:** fonts, font sizing, colors, contrast, density, and
   background choices that do not change scientific organization.

The separation matters because a theme should not move or hide scientific
content, and a layout variant should not change field values, execution, or
output meaning.

Initial exploration capabilities may include:

- a clearly labeled experimental layout selector
- live switching between supported layout variants
- a reset to the module's recommended layout
- optional pane resizing where the selected archetype supports it
- persistence of personal style choices
- a deliberate persistence policy for layout choices, potentially per user,
  per module, per device, or some combination
- a way for testers to identify or report the active layout configuration

Open design questions:

- Which choices are safe for ordinary users, and which should be tester-only?
- Should module authors restrict the variants that are valid for a module?
- Where should preferences live before login, after login, and across devices?
- Should pane sizes be remembered separately from the named layout variant?
- How do we guarantee that every variant remains usable with long inputs and
  long outputs?

### 3. Tabs, Collapsible Inputs, and Submitted-Input Summary

Long input areas should not continue to dominate the workspace after a run has
started. For selected modules, submission should transition the input region
from an editing surface to a compact, glanceable record of what was submitted.

Desired interaction:

1. Before submission, the full input editor is available, with sections or
   tabs where appropriate.
2. When the run starts, the heavyweight editor collapses.
3. A compact **Submitted Inputs** summary replaces it while the job is running
   and results arrive.
4. The summary shows the actual values associated with that run, not mutable
   current form state.
5. The user can explicitly reopen the editor to inspect, change, and rerun.

The summary may be enabled per module because short modules may not benefit
from the transition. Presentation metadata may specify:

- whether the editor auto-collapses on submit
- which submitted values are prominent
- grouping and ordering of summarized values
- whether advanced/default-valued inputs are initially omitted from the compact
  summary
- whether the full submitted-input record opens in a tab, accordion, or dialog

Reproducibility requirement: the compact summary must represent the immutable
submitted job inputs, including the values actually sent after defaults and
conditional behavior are resolved. It must not silently summarize later edits
to the form. Sensitive or internal values must not be exposed merely because
they exist in the submitted payload.

Tabs and collapsible regions should have defined roles rather than being used
as general decoration:

- tabs switch between peer work surfaces, such as Inputs, Results, Files, and
  Logs
- collapsible sections reduce the footprint of secondary or advanced material
  within a surface
- result arrival should not unexpectedly switch the user's active tab or move
  focus
- important running, error, and completion status remains visible regardless
  of the selected tab
- keyboard navigation and screen-reader state must remain understandable

Questions to resolve in a vertical slice:

- Does submission collapse the whole input pane or only completed sections?
- What happens when validation fails or submission cannot start?
- Does reopening inputs pause result auto-layout or change the pane split?
- How are file paths, repeaters, long text, and conditional fields summarized?
- How does the summary behave for reattached jobs and historical output replay?
- Which modules should opt in first?

## Phase Plan

### Phase 1: Design Baseline

- document current module archetypes
- document the minimum fallback layout behavior
- define the responsibilities and limits of `views`
- identify one vertical slice module for experimentation
- audit whether stable `/ui2` and experimental `/ui2-react` can share runtime
  and user space while keeping client assets independent
- define the boundary between module views, selectable layout variants, and
  personal style preferences

### Phase 2: Schema + Renderer Contract

- define the first `views` schema draft
- define how `views` metadata is loaded and merged
- document fallback behavior for missing or partial metadata
- document compatibility expectations for existing modules

### Phase 3: Vertical Slice

- implement Monomer Monte Carlo using the new layout approach
- test tabs, collapsible input sections, and the submitted-input summary
- verify field behavior, conditional logic, output replay, and sizing behavior
- verify that legacy html5 output is unaffected

### Phase 4: Archetype Rollout

- map all current modules to the chosen archetypes
- add curated `views` metadata where it provides clear value
- preserve safe default rendering where curation is not yet present

### Phase 5: Hardening

- refine accessibility, resizing, and responsive behavior
- verify Plotly and NGL lifecycle behavior under realistic job/result flows
- add targeted regression coverage for UI2 rendering assumptions

## Module Mapping Work Area

This section is intentionally incomplete. It is a place to accumulate module
classification as we go.

Proposed initial buckets:

- compact modules
- sectioned workbench modules
- branching workflow modules
- results-first modules

## Open Questions

- What is the smallest useful `views` schema that still gives us meaningful
  layout control?
- Should section grouping rely only on explicit metadata, or can the renderer
  derive some structure from labels and existing field patterns?
- How should fallback layout behave for long modules with no curated metadata?
- Which output types deserve first-class grouped containers in the renderer?
- How much layout behavior belongs in generator-produced data versus client-side
  interpretation?
- What is the best first vertical slice module for balancing complexity and
  learnings?
- Can the Zazzie3 deployment host stable and experimental UI2 clients against
  the same user/project/job space without duplicating scientific definitions?
- What preferences should be durable per user, module, and device?
- What is the canonical source for the immutable submitted-input summary?

## Decision Log

Use this section to append concise dated decisions as they become real.

- 2026-07-09: Initial draft created. Working conclusion is that React and
  shadcn should be treated as implementation enablers, while a presentation-only
  `views` model is the actual leverage point for scientific layout.
- 2026-07-09: Added exploration requirements for an adjacent experimental
  `/ui2-react` deployment, tester/user layout and style choices, and an optional
  post-submit transition from the full input editor to an immutable compact
  submitted-input summary.
- 2026-07-09: Chose one fixed layout for the current exploration phase and
  postponed user-selectable layouts. Abandoned the adjacent `/ui2-react`
  deployment idea in favor of working directly in UI2 and temporarily
  postponing developer testing when UI2 is broken.
- 2026-07-09: Selected Monomer Monte Carlo as the first React/shadcn vertical
  slice. React owns the MMC workbench composition while a narrow bridge reuses
  existing UI2 fields, conditional logic, file controls, submission, polling,
  Plotly, NGL, and reattachment behavior. Other modules retain the existing UI2
  renderer during this migration step.
- 2026-07-09: Chose fit-to-pane sizing for the MMC trajectory plot. The UI2
  renderer removes producer-supplied Plotly width and height only for this
  curated surface, observes its pane, and resizes the existing graph in place.
  An Expand control promotes that same result card to a viewport overlay; it
  does not create a second Plotly instance or introduce an internal scrolling
  plot canvas. Close and Escape return the card to the workbench.
