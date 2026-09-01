# UI2 responsive axis-title overflow shared-gap report

Status: approved for implementation 2026-09-01.

## Application symptom and smallest application-level attempt

The Monomer Monte Carlo trajectory figure has a long lower-subplot y-axis
title that intersects an upper-subplot x-axis title at some responsive widths.
Increasing normalized subplot gutters and adding a producer-authored `<br>`
improved selected widths but failed again at another supported width. Those
changes cannot react to the rendered font or available axis length.

## Neutral reproduction

The `ui2_views` workbench fixture opts a generic multi-subplot Plotly output
into `plotPresentation.axisTitleOverflow: "wrap"`. Executable layout tests use
neutral observation labels and several rendered axis lengths to reproduce
one-, two-, and three-line states without SASSIE module or output identities.

## Existing contract gap

Current view metadata can select plot fit, presentation profiles, and generic
trace styles, but it cannot express responsive axis-title overflow. A driver
can insert renderer markup only by violating UI2 ownership, and an application
DOM patch would duplicate the normal UI2 render, resize, completion, and
reattachment lifecycle.

## Generic contract

An application view may opt a result group into
`plotPresentation.axisTitleOverflow: "wrap"`. UI2 measures each plain axis
title against its rendered axis length and font, wraps at whitespace and `/`,
never splits a word, and recomputes after resize. Rich titles with explicit
markup are unchanged. The saved producer figure remains authoritative and is
never mutated.

## Compatibility and rollback

Opted-in figures receive responsive wrapping. Non-opted-in figures and HTML5
retain their existing behavior. Removing the view token disables the feature;
removing the helper and its UI2 call sites restores the previous renderer.

## Approval and ownership

The repository owner explicitly requested implementation, guarded commits,
GenApp UI2 regeneration, Plot Presentation Lab deployment, and deployed review
for `ehb54/zazzie#249`. The implementation is application-neutral and contains
no SASSIE module ids, output ids, or scientific vocabulary in GenApp core.
