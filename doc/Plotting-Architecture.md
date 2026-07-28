# SASSIE-web Plotting Architecture

GitHub issue `ehb54/zazzie#193` is the governing decision. This file is the
local, reviewable entry point for work that spans `madscatt/zazzie`,
`ehb54/zazzie` (`genapp_zazzie`), and `ehb54/genapp`.

## Required ownership

- SASSIE owns scientific calculations, versioned semantic datasets/events,
  canonical numeric artifacts, units, uncertainties, sequence/revision,
  operation, completeness, availability, and scientific metadata.
- `genapp_zazzie` owns validated renderer-neutral `plot_spec` definitions and
  the mapping from scientific datasets and quantities to panels and semantic
  series roles.
- UI2 transport owns ordered delivery and durable reattachment.
- `ui2_react` owns normalized `plot_state`, responsive layout, typography,
  palettes, redundant visual cues, legends, toolbars, accessibility,
  throttling, export, and renderer translation.
- Plotly is a renderer adapter only.

## Required path

```text
SASSIE semantic dataset/event
  -> thin GenApp transport adapter
  -> shared normalized plot_state reducer
  -> validated renderer-neutral plot_spec
  -> native ui2_react plot component
  -> Plotly renderer adapter
```

Moving Plotly construction from SASSIE into a module-specific driver or helper
does not satisfy this architecture.

This is a forward-only replacement. A migrated module does not retain a
module-local Plotly construction path for legacy HTML compatibility.

## Prohibited contracts

SASSIE output and module `plot_spec` definitions must not contain Plotly traces,
trace indexes, `data`/`layout`/`config` figure objects, renderer axis names,
literal theme colors, fonts, hand-built margins, pixel dimensions, legend
placement, toolbar policy, or transport configuration.

Module-specific drivers and helpers must not construct Plotly objects for UI2.
They may map a runtime destination, but they must preserve the scientific
dataset identifiers, quantities, units, revisions, operations, and values.

## Lifecycle

Live, completed, failed, and reattached plots use one reducer and one
`plot_spec`:

1. initial dataset snapshot;
2. bounded append or replace;
3. periodic resynchronization snapshots;
4. authoritative completion or partial-failure state;
5. persisted normalized state for reattach;
6. clear on a new run.

The live path must not poll files. A completed semantic artifact may be read
once only when direct final delivery is unavailable.

## Completion gate

A plot migration is complete only when schema validation, scientific-value
parity, event replay, bounded load, resynchronization, failure recovery,
completion, reattach, responsive/mobile behavior, accessibility, and
non-color-only series identification are verified.

The application migration registry records one of:

- `not_migrated`
- `semantic_data_ready`
- `harness_candidate`
- `accepted`

Only `accepted` modules may be used as plotting implementation references.
Scientific module port status and plotting migration status are independent.
