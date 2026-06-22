# UI2 Renderer ROA

Read-only design note for the proposed parallel `ui2` path.

This document captures one specific option for issue 38 and related UI2
brainstorming: keep the current module JSON tree as the source of truth and
build a parallel UI2 renderer that learns from the expanded GenApp runtime
model instead of asking maintainers to hand-author a second app definition.

## Status

This is an option under evaluation, not an adopted implementation plan.

## Recommendation

Treat UI2 as a renderer-first path.

Do not start with a second human-maintained module/menu JSON tree. Do not make
UI2 depend on large per-module override files as the normal workflow.

Instead:

1. Keep existing app JSON as the canonical scientific and runtime contract.
2. Let the normal GenApp pipeline expand panels, repeaters, runtime-owned
   controls, dynamic output registration, and field templates.
3. Generate a UI2-oriented render model from that expanded structure.
4. Render `output/ui2` from the same contract with a different layout and
   presentation layer.

## Why This Option Exists

The tidy override-file model breaks down quickly against the real application
tree.

An audit of `/Users/curtisj/git_working_copies/genapp_zazzie/modules` found:

- `40` module JSON files
- about `869` input fields
- about `182` output fields
- about `464` `repeat` references
- about `137` `repeater` fields
- about `178` explicit `layout` blocks
- only `4` modules with explicit top-level `panels`
- `6` button or hook workflows
- app-level use of dynamic outputs and append-style outputs

Representative high-risk modules include:

- [align.json](/Users/curtisj/git_working_copies/genapp_zazzie/modules/align.json:2):
  explicit panels plus advanced-input repeaters and progress/html output
- [extract_utilities.json](/Users/curtisj/git_working_copies/genapp_zazzie/modules/extract_utilities.json:1):
  nested listbox-driven branches, repeaters, many output plots, and existing
  per-field layout
- [multi_component_analysis.json](/Users/curtisj/git_working_copies/genapp_zazzie/modules/multi_component_analysis.json:1):
  hook-backed buttons, `_allformdata`, tableized repeats, hidden calculated
  matrix fields, and large branching utility modes
- [sas_assembly.json](/Users/curtisj/git_working_copies/genapp_zazzie/modules/sas_assembly.json:1):
  modern outputs with little explicit layout metadata

These modules are not well served by a field-by-field UI2 patch authoring
workflow. That would become a second app tree in practice.

## Core Idea

The current GenApp pipeline already does important normalization work:

- `etc/perl/ga_layout.pm` expands module layout, propagates panel defaults, and
  injects runtime-owned controls into the layout object.
- `languages/html5/js/repeat.js` binds `repeat` and `repeater` relationships,
  including tableized and integerpair-driven repeats.
- `languages/html5/js/dynamic_output.js` registers and materializes runtime
  output groups.
- `languages/html5/js/button.js` preserves hook-backed button behavior,
  including `_allformdata`, file selection, and helper-program calls.

UI2 should sit after those behaviors are understood, not before them.

In practical terms:

```text
module JSON
  -> existing GenApp expansion
  -> UI2 manifest / render model
  -> output/ui2
```

not:

```text
module JSON
+ large ui2 override files
  -> separate quasi-app
  -> output/ui2
```

## Views Layer

`views/` should be treated as a general GenApp authoring layer, not as a
UI2-only concept.

The intended lookup model is:

```text
modules/<module>.json
+ views/<module>.json
+ ui2/views/<module>.json
-> output/ui2
```

`modules/<module>.json` remains the canonical scientific and runtime contract.
`views/<module>.json` is optional, target-neutral organization metadata.
`ui2/views/<module>.json` is optional UI2-specific organization metadata.

View files should describe presentation intent such as sections, grouping,
initial collapsed state, matrix rendering preference, action placement, and
output grouping. They should not redefine field types, defaults, repeat
dependencies, executable names, hook payloads, output ids, or backend request
shape.

Missing view files are valid and mean "infer from the module and layout data."

## Module Overrides

The preferred full replacement path for UI2 modules is:

```text
ui2/module_overrides/<module>.json
```

This path exists for rare cases where a module contract is not salvageable for
the UI2 target. It is intentionally more explicit than `ui2/modules/`, because
copying every module into a second tree would create a second app definition.

For compatibility with existing GenApp target-specific conventions,
`ui2/modules/<module>.json` may still be used as a fallback full replacement
path, but `ui2/module_overrides/` takes precedence when both are present.

## What UI2 Should Infer Automatically

The renderer should derive most structure from the current app contract:

- Existing explicit `panels` where they already exist.
- Header-like label fields and hline markers as likely section boundaries.
- `repeat` and `repeater` graphs as conditional-group boundaries.
- Common advanced-input checkboxes as collapsible advanced sections.
- Output clustering by role and type:
  progress/messages, plots/viewers/images, logs/textareas, dynamic outputs.
- Runtime-owned submit/reset/progress/message fields as fixed system controls,
  not user-authored scientific fields.

This keeps the first prototype focused on rendering behavior instead of schema
cleanup.

## What UI2 Should Preserve Exactly

UI2 should not reinterpret these contracts during the first phase:

- field ids
- module ids
- executable names
- helper-program hook behavior
- `repeat` and `repeater` semantics
- dynamic-output semantics
- submit/reset lifecycle
- request serialization and backend PHP expectations
- last-value and restore behavior where already supported

The UI can look different while the scientific and runtime contract remains the
same.

## Role Of Overrides

Small UI2 hint files may still be useful, but only as an escape hatch.

Good hint-file uses:

- rename an inferred section
- force a section to render as tabs instead of stacked bands
- mark a result group as initially collapsed
- override one or two poor inference decisions

Bad hint-file uses:

- restating most module fields
- redefining repeat graphs
- duplicating button and hook wiring
- changing scientific input/output contracts

If a UI2 hint file starts to look like a second module JSON, the design has
failed.

## Suggested Prototype Sequence

1. Add a `ui2` target and separate `output/ui2` destination, leaving legacy
   generation untouched.
2. Begin with behavior-clone output that proves the target can consume the
   canonical module contract.
3. Generate a UI2 manifest only for a small set of representative modules:
   `align`, `extract_utilities`, `multi_component_analysis`, and
   `sas_assembly`.
4. Emit an audit view for each manifest:
   inferred sections, repeat groups, runtime-owned controls, output groups,
   and uncertain guesses.
5. Build UI2 rendering around the existing runtime behavior instead of
   replacing field logic.
6. Add view files only where inference repeatedly fails.

## Benefits

- avoids a second human-maintained module tree
- protects existing scientific/runtime contracts
- keeps legacy `output/html5` stable during prototype work
- scales better to repeater-heavy and helper-heavy modules
- gives UI2 a realistic chance of handling messy historical modules

## Risks

- inference quality may be uneven across old modules
- some modules may expose ambiguous structure that needs explicit hints
- renderer work still has to preserve fragile runtime expectations
- this does not remove the need for careful browser/runtime testing

## Bottom Line

UI2 should begin as a new renderer for the existing app contract, not as a new
app contract with large override files.

That is the most realistic path for this codebase because it works with the
messy real module tree instead of assuming maintainers will keep two
field-by-field definitions synchronized by hand.
