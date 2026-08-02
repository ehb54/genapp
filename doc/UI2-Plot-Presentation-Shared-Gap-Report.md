# UI2 Plot Presentation shared-gap report

Status: approved for implementation 2026-08-02.

## Symptom and smallest application-level attempt

An application can already map a scientific trace role to a generic UI2 token
through `views/<module>.json`. The current UI2 implementation only gives the
`context` token one fixed translucent line color and can hide a legend entry.
It has no reusable, artist-editable catalog for colors, markers, fonts, grids,
or legend appearance. Putting those values in a driver is prohibited by the
Plotly contract; putting them directly in views makes the visual work harder to
read and mixes it with result layout.

## Neutral reproduction

Two unrelated modules both produce ordinary Plotly traces whose scientific
metadata has stable roles. Each view maps those roles to generic presentation
tokens such as `primary`, `reference`, `experimental`, and `context`. They
need a shared default token catalog and may opt into a named application
presentation that refines those token styles. A module that does not opt in
must retain the existing UI2 default appearance.

## Why existing contracts are insufficient

Views can say that a role uses a token, but cannot name a separately maintained
catalog or express a readable, inheritable set of token, font, background,
grid, and legend choices. Drivers cannot carry these choices. A generic UI2
resolver is therefore needed between presentation-only application metadata
and Plotly attributes.

## Proposed generic contract

The view declares an optional `plotPresentation.profile` string and maps trace
roles to generic `token` strings. An application-provided UI2 asset registers
profiles under `window.GENAPP_PLOT_PRESENTATIONS`. A profile may define
`font`, `background`, `grid`, `legend`, and `styles` keyed by generic token.
Each token style may set documented Plotly-safe presentation values: color,
opacity, line width/style, marker shape/size, and legend visibility.

The UI2 resolver merges the default UI2 theme, then the selected profile, then
the token style. It rejects geometry and manual-placement properties. It does
not inspect module ids, output ids, or scientific role names.

## Consumers, compatibility, and rollback

The first opted-in consumer is a SASSIE monomer Monte Carlo result view. A
neutral fixture exercises the same capability without a SASSIE module name.
Non-opted-in modules continue to use their present UI2 layout and trace
appearance. Removing the profile declaration or registration rolls an
application back to that default without changing scientific output or saved
job reattachment.

## Approval

The SASSIE-web owner explicitly approved this shared UI2 extension on
2026-08-02 after reviewing the implementation plan for the Plot Presentation
layer. The extension remains governed by the ordinary Plotly transport and
reattachment contract in `doc/Plotting-Architecture.md`.
