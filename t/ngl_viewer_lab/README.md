# NGL Viewer Lab

This is a local development page for exploring molecular structures and
Gaussian cube volumes with the same NGL 0.10.4 bundle shipped by GenApp.

From the GenApp repository root, run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/t/ngl_viewer_lab/`.

The page reads selected files directly in the browser. It does not require a
generated GenApp application. Structure views produce a preview of the current
GenApp NGL payload. Volume payloads are not yet part of the GenApp output
contract.

Use **Demo molecule** and **Demo cube** to exercise the controls immediately.

To use SasMol basis selections, save the current coordinates, or load a local DCD trajectory, start the local
Sasmol helper instead of the static server. It listens only on `127.0.0.1`;
selected files stay on your computer. The helper uses SASSIE's existing
`basis_to_python` and `Molecule.get_subset_mask` path for selections, and
SasMol reads the DCD.

```sh
PYTHONPATH=/path/to/zazzie/src /path/to/anaconda3/bin/python t/ngl_viewer_lab/local_sasmol_helper.py
```

Then open `http://127.0.0.1:8765/t/ngl_viewer_lab/`. Use **Open molecule** to
load another structure or attach a trajectory to the current molecule. The
helper supplies the basis-field/value list for a current PDB; it uses SasMol's
existing basis parser and reports the matching atom count. Leave a layer
selection blank for all atoms, or enter a basis such as `name CA`, `resname
GLY`, or `segname PAI1 and resid >= 10`, then choose **Apply selection**.

## Current capabilities

- local PDB, mmCIF, SDF, MOL2, PQR, and GRO structure loading;
- local Gaussian cube loading;
- multiple molecular structures, with a current molecule and per-molecule trajectories;
- SasMol-basis molecular representations and a PDB basis-value catalog;
- representation, coloring, opacity, and visibility controls;
- positive and negative volume isosurfaces;
- atom picking, centering, spinning, and clearing;
- load a matching local DCD through Sasmol, with frame selection and playback;
- save the current frame as a PDB through SasMol;
- GenApp-compatible structure payload preview;

The generated UI2 widget also has an opt-in component-placement mode for
builder modules. It uses the multi-structure `components` payload, locks the
first component, and exports one row-major rigid 4 by 4 matrix per component
to a declared ordinary input. See `doc/NGL-Viewer-Widget.md` for the contract.
