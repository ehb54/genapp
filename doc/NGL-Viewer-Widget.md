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
    "mouse_preset": "default"
  }
}
```

The configuration is intentionally declarative.  It sets module defaults and
records what a module can provide; it does not cause a density map or trajectory
to be created.  It is the only source of viewer presentation policy. Drivers
must not send runtime `viewer` overrides, camera choices, browser-control
settings, or other renderer policy. When no camera is declared, the viewer
defaults to orthographic projection.

`additional_components` enables the optional multi-molecule contract.  When it
is absent or false, the legacy single-structure payload remains unchanged.

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

The topology is loaded first and the trajectory is attached with NGL's
`StructureComponent.addTrajectory` API.  Supported trajectory formats depend on
the bundled NGL parser and include DCD, TRR, XTC, and NCTRAJ/NetCDF.  The
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
