# UI2 NGL viewer widget

UI2 `ngl` outputs are a reusable molecular-viewer widget.  A module supplies a
normal NGL structure payload; the viewer owns the local display controls.  This
keeps structure generation in SASSIE and avoids a separate viewer implementation
for each module.

## Module configuration

Add optional `viewer` metadata to the NGL output field in a module JSON file:

```json
"viewer": {
  "capabilities": {
    "trajectory": true,
    "volume": true,
    "layer_editor": true,
    "additional_components": false
  },
  "display": {
    "camera": "orthographic",
    "background": "#050909",
    "axes": false,
    "mouse_preset": "default",
    "rollover_help": false
  },
  "trajectory": {
    "superpose": false
  }
}
```

The configuration is intentionally declarative.  It sets module defaults and
records what a module can provide; it does not cause a density map or trajectory
to be created.  It is the only source of viewer presentation policy. Drivers
must not send runtime `viewer` overrides, camera choices, browser-control
settings, or other renderer policy. When no camera is declared, the viewer
defaults to orthographic projection.

`trajectory.superpose` is an optional display-only boolean for completed
file-backed and embedded multi-model trajectories. Omit it to retain the
bundled NGL default. Set it to `false` when the producer's coordinate frame is
scientifically meaningful and must be shown directly; it does not change loaded
coordinates, the saved trajectory, or any SASSIE calculation.

The molecular canvas owns ordinary mouse-wheel and trackpad scrolling, so it
zooms immediately without requiring focus or opening **Viewer settings**. Page
scrolling remains available outside the canvas, and browser zoom shortcuts are
left alone. Rollover help is off by default inside a molecular viewer because
large tooltips can obscure a structure during inspection. A user can enable it
locally in **Viewer settings**; `display.rollover_help: true` only changes that
initial local state. Neither setting is submitted or saved with the result.

`additional_components` enables the optional multi-molecule contract.  When it
is absent or false, the legacy single-structure payload remains unchanged.

`selection_inspector` enables an optional, local inspection panel when the
structure payload contains a generic `selectionInspector` object.  It can list
named selections, center the structure on one, and display corresponding
coordinate residues.  `selection_visibility` is a separate opt-in capability:
when both capabilities are enabled, the top viewer controls may offer **Whole
structure** and a producer-named selection-only view.  The complete structure
remains the default. Choosing a group in the lower inspector centers and shows
only that group; choosing its all-selections item restores the selection-only
view. Existing viewers and selection inspectors are unchanged unless they opt
in to this second capability.

The generic payload uses NGL-resolved atom selections, not module-specific
scientific terms:

```json
{
  "selectionInspector": {
    "all_selection": "@1-20,41-60",
    "all_boundary_selection": "@1,20,41,60",
    "groups": [
      {"id": "region-1", "label": "Region 1", "selection": "@1-20", "boundary_selection": "@1,20", "residue_ids": ["residue-0"]}
    ],
    "segments": []
  }
}
```

Visibility and focusing are browser-local inspection state. They do not change
the loaded coordinates, scientific selections, or saved result files.

`stream_preview_coverage` is optional metadata for a bounded live-coordinate
preview. It declares which generic frame value is the population counter and
the producer-supplied label for that population:

```json
"stream_preview_coverage": {
  "frame_field": "frame_id",
  "label": "accepted structures"
}
```

The supported fields are `frame_id` and `metadata.<name>`. UI2 may show the
number of rendered preview frames as a percentage of that declared counter. It
does not infer scientific meaning from a frame id. This label describes a
bounded live preview only; a completed file-backed trajectory reports its own
canonical frame count separately.

## Multiple molecular structures

An opted-in payload may provide `components`.  Each item is an independently
loadable structure with its own representations and optional trajectory.  The
first item must also be mirrored in the legacy top-level fields so existing
clients continue to render it.

```json
{
  "loadname": "first.pdb",
  "representation": "cartoon",
  "components": [
    {"id": "first", "name": "Reference", "loadname": "first.pdb", "representations": [{"type": "cartoon"}]},
    {"id": "second", "name": "Comparison", "loadname": "second.pdb", "representations": [{"type": "ball+stick"}], "trajectory": {"loadname": "second.dcd", "loadparams": {"ext": "dcd"}}}
  ]
}
```

The viewer presents a current component.  Visibility, layers, frame playback,
and coordinate export apply to that component.  A trajectory never transfers
between structures: its atom order and count must match its own topology.
The current widget supports one primary structure component plus zero or more
volume surfaces.

### Direct component placement

Direct placement is a separate, opt-in UI2 capability. Declare it on the NGL
output field and name the ordinary input that will receive transforms:

```json
"viewer": {
  "capabilities": { "component_placement": true },
  "placement": { "transform_field": "component_transforms" }
}
```

The output payload supplies at least two independent `components`. Each may
provide `id`, `label`, `loadname`, `loadparams`, `representations`, `locked`,
`initial_transform`, and an optional `trajectory` coordinate source. An exact
PSF topology may be paired with a matching PDB declared as
`{"ext": "pdb", "asTrajectory": true}`. Atom order and atom count must match.
For this pair UI2 displays the PDB-parsed structure, preserving its coordinates,
residue and trace records, backbone links, and selection behavior. It replaces
only the PDB parser's inferred chemical bond table with the exact PSF bond
table. This retains cartoon rendering and correct local bond geometry without
passing the PDB to NGL's file-trajectory constructor. Components without a
paired PSF and PDB retain the existing single-file behavior. The transform is
a row-major homogeneous 4 by 4 matrix. UI2 always treats the first component
as locked.

The controls start in Inspect view, where dragging changes the camera and does
not alter component transforms. Users must explicitly select Move or Rotate
before direct placement is enabled. Move mode translates in the screen plane;
Shift-drag translates in depth. Rotate mode rotates the selected component.
UI2 writes the complete matrix array as JSON to the declared field after every
placement change. The receiving module owns validation and scientific
interpretation. Non-opted NGL outputs keep their existing renderer.

The fixed first component is identified separately and is not offered in the
movable-component selector. A producer may also opt into generic live distance
guides:

```json
"viewer": {
  "capabilities": {
    "component_placement": true,
    "placement_guides": true
  },
  "placement": {"transform_field": "component_transforms"}
}
```

The runtime payload then supplies zero-based atom endpoints and producer-owned
distance thresholds:

```json
"placement_guides": [{
  "id": "junction_1",
  "label": "Component 1 C to Component 2 N",
  "from": {"component_id": "component_1", "atom_index": 24},
  "to": {"component_id": "component_2", "atom_index": 0},
  "target_distance_angstrom": 1.33,
  "warning_distance_angstrom": 3.04,
  "maximum_distance_angstrom": 3.8
}]
```

UI2 transforms the endpoint coordinates, draws a live connector, and labels
the distance as plausible, stretched, or out of reach using the supplied
warning and maximum values. This is browser-local guidance. The producer must
recalculate authoritative distances, clashes, bonding, and other scientific
diagnostics from the submitted transforms.

## Structure payload

The existing structure contract remains valid:

```json
{
  "loadname": "results/model.pdb",
  "loadparams": { "ext": "pdb" },
  "representations": [
    { "name": "protein", "type": "cartoon", "params": { "sele": "protein", "colorScheme": "chainid" } },
    { "name": "ligand", "type": "ball+stick", "params": { "sele": "not protein", "colorScheme": "element" } }
  ]
}
```

Users can show or hide the molecule, choose orthographic or perspective camera,
choose a background and mouse preset, reset/spin/fullscreen the view, and edit
representation layers and selections locally.  Those adjustments are local UI
state, not changes to a SASSIE result file.

## Gaussian cube volume payload

Place a density payload alongside the structure payload:

```json
{
  "structure": { "loadname": "results/model.pdb", "loadparams": { "ext": "pdb" } },
  "density": {
    "loadname": "results/density.cube",
    "loadparams": { "ext": "cube" },
    "surfaces": [
      { "name": "positive", "isolevel": 0.015, "color": "#287cff", "opacity": 0.45 },
      { "name": "negative", "isolevel": -0.015, "color": "#ff3c52", "opacity": 0.45 }
    ]
  }
}
```

The older single `density.surface` form is still supported.  Each surface has
its own on/off switch, isolevel, colour, and opacity control.

## File-backed trajectories

A structure payload may attach a coordinate trajectory to the same structure:

```json
{
  "loadname": "results/reference.pdb",
  "loadparams": { "ext": "pdb" },
  "trajectory": {
    "loadname": "results/accepted.dcd",
    "loadparams": { "ext": "dcd" }
  }
}
```

The topology is loaded first. UI2 loads the trajectory URL through NGL's
`autoLoad` parser. Genuine trajectory objects are attached with
`StructureComponent.addTrajectory`. A PSF structure paired with a PDB declared
with `asTrajectory: true` uses the PDB-parsed structure for display and replaces
only its inferred chemical bonds with the PSF bond table. Supported trajectory
formats depend on the bundled NGL parser and include DCD, TRR, XTC, and
NCTRAJ/NetCDF. The
topology and trajectory must have matching atom order and atom count.  The
widget exposes frame selection and playback once NGL reports the trajectory
frame count.

## Live coordinate frames

For a capability-gated live preview, send a topology/snapshot once and then
append coordinates with the same declared NGL output id. A frame contains
`atom_count`, `coordinates`, and optional generic `frame_id`, `label`,
`timestamp`, and opaque `metadata`. UI2 validates topology compatibility and
retains bounded history automatically when the completed snapshot uses the same
topology. Drivers must not request browser retention or encode module-specific
viewer behavior such as accepted/trial/milestone fields.

## Selection expressions

The local NGL viewer lab accepts user-facing SASSIE/SasMol basis syntax, for
example `name CA`, `resname GLY`, `segname SYSTEM and resid >= 10`, or
`moltype protein`. It resolves the basis with SASSIE's `basis_to_python` and
`Molecule.get_subset_mask` path; it must not implement a second parser in the
browser.

The output payload still carries NGL's resolved selector, normally an atom-index
list such as `@4,11,21`. This keeps the normal NGL structure contract intact.
For generated jobs, a driver or server-side helper must resolve a SasMol basis
against its display PDB before returning the payload and before exposing this
same editor. Do not send a SasMol basis expression as `params.sele`: NGL does
not understand that language.

Use `t/ngl_viewer_lab/` for local exploration.  It can load local PDB/mmCIF and
Gaussian cube files, then attach a matching trajectory file to the loaded
structure.  Start it with:

```sh
python3 -m http.server 8000
```
