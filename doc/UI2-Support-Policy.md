# GenApp Web Target Support Policy

Status: accepted 2026-08-01.

## Decision

UI2 is the supported modern GenApp web target. React and shadcn are the
preferred UI2 workbench renderer and component toolkit; they are not a separate
`ui2-react` target or a second application runtime.

The plain-JavaScript UI2 runtime remains authoritative for module loading,
field production and values, repeat and dependency behavior, file handling,
submission, polling, runtime events, output rendering, and job reattachment.
React consumes those capabilities through the UI2 bridge and owns workbench
composition, responsive layout, presentation components, and local display
state. Presentation-only `views` metadata may organize declared inputs and
outputs, but must not redefine scientific meaning or backend contracts.

HTML5 is a legacy maintenance target. Existing HTML5 behavior must not be
silently changed while the target remains deployed, and shared GenApp changes
must retain appropriate legacy regression coverage. New UI2 fields, widgets,
workflows, layouts, and presentation features are not required to be
implemented in HTML5.

## Support Levels

| Surface | Support level | Compatibility commitment |
| --- | --- | --- |
| UI2 with React workbenches | Primary | New web design, workflows, and presentation capabilities land here. |
| Native UI2 renderer | Fallback and reference | Must preserve the generic UI2 scientific/runtime contract and remain usable for modules without a curated React view. Equivalent layout and workflow polish are not required. |
| HTML5 | Legacy maintenance | Preserve existing deployed behavior and address critical regressions or security problems. New-feature parity with UI2 is not required. |

Backward compatibility means preserving scientific inputs and outputs, module
and field identities where practical, driver execution, saved-job behavior,
and durable final-output reattachment. It does not mean identical layout,
widgets, or workflows across HTML5, native UI2, and React workbenches.

## Ownership Test For New Features

A capability belongs in module JSON, the driver/runtime contract, or UI2 core
when it affects submitted values, validation, repeat/dependency behavior,
files, job execution, runtime transport, output meaning, or reattachment.
React may invoke or arrange that capability, but must not independently own its
backend request/response semantics.

A capability belongs in `views`, React/shadcn, or UI2 styling when it changes
grouping, cards, tabs, panes, expansion, density, responsive behavior,
typography, color, or other presentation state without changing scientific or
runtime meaning.

When a custom React view needs behavior that is not exposed, add it to UI2 core
first and extend the renderer bridge narrowly. Do not create a parallel module
definition tree or a standalone `ui2-react` target.

The mandatory decision and review gate for a proposed shared UI2 change is
[`UI2-Core-Extension-Policy.md`](UI2-Core-Extension-Policy.md). In particular,
an application screenshot is not by itself authorization to add a module-shaped
branch, producer metadata key, or scientific vocabulary to GenApp core.

## Framework Portability

The portability boundary is UI2, not HTML5. A future renderer based on Vue,
Svelte, Web Components, or another technology should reuse the generated UI2
model, presentation-only `views` metadata, field/output producers, job runtime,
and reattachment behavior. A new renderer adapter may be required because the
current bridge exchanges UI2-owned DOM nodes and forms; that bounded adapter is
an acceptable framework dependency.

## HTML5 Retirement Gate

Removing HTML5 generation or deployment is a separate decision from ending
feature parity. Before removal:

1. Inventory active applications, users, deployment paths, and integrations
   that still depend on HTML5.
2. Verify their required workflows in UI2, including submission, completion,
   failure handling, and fresh-window job reattachment.
3. Preserve a reproducible final HTML5 source/build state and its operational
   notes.
4. Remove HTML5 from application directives and deployment procedures through
   explicit, reviewed changes rather than incidental UI2 work.

Until that gate is completed, keep target filtering and legacy regression
tests that prevent shared generator changes from silently altering HTML5.

## Application Repository Adoption

Application repositories may record their own migration status, rollout gates,
and deployed-target policy. They should reference this document for the
renderer boundary and must not restate React as a separate GenApp target.
