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
    "streaming": true,
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
to be created.  A driver may provide a top-level `viewer` object in its output
payload to refine these settings for one job.  Runtime settings override module
settings, with `capabilities` and `display` merged by key.  When no camera is
declared, the viewer defaults to orthographic projection.

`additional_components` is reserved for a future multi-molecule input contract.
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
frame count.  The existing `preserve_live_frames` streaming contract remains
separate and is still useful for frames produced during a running calculation.

## Selection expressions

Representation layer selections are passed directly to NGL's selection parser.
In addition to common protein/residue selections, the layer editor accepts
expressions using atom and trajectory metadata such as:

`name CA`, `index 0-20`, `resid 10-30`, `segname SYSTEM`, `beta > 0`,
`backbone`, and `charge > 0`.

Use `and`, `or`, and `not` to combine terms, for example
`segname PROA and backbone` or `name CA and resid 10-40`.  A module can provide
these as `sele` values in its `representations` payload, while users can edit
them in the viewer's layer editor.

## Streaming and retained trajectory

The widget accepts the existing coordinate-frame event format: topology is
loaded once, then a frame carries a Float32-compatible `coordinates` array and
matching `atom_count`.  The viewer updates the component positions in place and
coalesces renders.  It retains a bounded history for review controls, so a
long-running calculation does not grow browser memory without limit.  Drivers
should stream meaningful milestones rather than every high-frequency simulation
step.

Use `t/ngl_viewer_lab/` for local exploration.  It can load local PDB/mmCIF and
Gaussian cube files and includes a synthetic streaming benchmark with retained
frame playback.  Start it with:

```sh
python3 t/ngl_viewer_lab/stream_server.py --host 127.0.0.1 --port 8765
```
