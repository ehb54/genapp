# UI2 3D Scene Contrast Shared Gap

## Evidence and ownership

Issue `ehb54/zazzie#318` reports a hidden spatial-series legend and unreadable
3D axes. The smallest application correction is `legend: shown` in the Extract
Utilities profile; the producer already supplies both traces and their roles.
No scientific values, labels, units, or driver changes are required.

The neutral reproduction is `t/fixtures/plotly_scene_contrast.html` and the
Node behavior coverage is `t/unit_tests/plotly_scene_contrast.t`. Before the
fix, calling `GenAppPlotlySurface.apply` with a dark canvas and ordinary
`scene.xaxis/yaxis/zaxis` titles changed Cartesian axes but left every scene
axis unchanged. Numbered scenes had the same gap. The fixture uses generic
observations and units, without application names, output ids, or scientific
role parsing.

Application YAML and view metadata cannot express automatic final-surface
contrast for nested 3D axes. Fixed driver colors would violate the plotting
boundary and fail when a user changes the canvas. Ordinary UI2 and the Lab
already call the same resolver; Chart Editor already receives displayed data
and layout. No second renderer or editor customization is needed.

## Generic contract

Extend the existing final-surface pass to declared `scene`, `scene2`, and other
numbered scenes. Resolve the scene canvas from its explicit or template
background, falling back to the selected plot canvas. Resolve each axis plane
from its explicit or template background, falling back to the scene canvas.
Composite transparency before selecting readable text and line colors. An
axis with `showbackground: false` uses the scene canvas for contrast.

Supply scene-axis tick/title colors, tick and axis lines, grids, and zero
lines. Use the existing stronger zero-line token for 3D grids and axis lines,
which must remain discernible through perspective and rotation. Preserve font
sizes/families, scientific titles/units, ranges, axis types, visibility flags,
camera, aspect mode, and the saved source figure. Do not create a scene in a
figure that declares none or alter Plotly templates in place.

This corrects the existing surface contract and introduces no directive,
producer flag, YAML property, or module branch. Consumers already using the
surface pass receive the correction. A Cartesian-only control and consumers
without scene layouts retain existing behavior; non-UI2 rendering is unchanged.

## Approval, verification, and rollback

Joseph Curtis approved the plan and exact manifest, explicitly including
GenApp core changes, in the current chat on October 14, 2026. Core approval
does not authorize deployment, authenticated account access, Lab publication,
or Lab recompilation.

Behavior coverage checks light/dark canvases, mixed scene/plane surfaces,
transparent planes, numbered scenes, template inheritance, idempotence,
immutable saved payloads, and unchanged Cartesian behavior. The real Plotly
fixture covers rotation, redraw, expansion/restore, completion, saved-output
reconstruction, and the displayed-layout editor handoff. Application tests
check both spatial legend entries and Lab/UI2 use of the shared resolver.
Linux runtime and deployed UI2/Lab/Chart Editor acceptance remain required;
local Mac evidence does not establish deployment acceptance.

Rollback restores the prior resolver and the previous application profile,
then regenerates the application presentation registry through its compiler.
Saved scientific results require no migration. HTML5 source and generation
contracts remain unchanged.
