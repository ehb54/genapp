# NGL Viewer Lab

This is a local development page for exploring molecular structures and
Gaussian cube volumes with the same NGL 0.10.4 bundle shipped by GenApp.

From the GenApp repository root, run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/t/ngl_viewer_lab/`.

The page reads selected files directly in the browser. It does not upload them
or require a generated GenApp application. Structure views produce a preview of
the current GenApp NGL payload. Volume payloads are not yet part of the GenApp
output contract.

Use **Demo molecule** and **Demo cube** to exercise the controls immediately.

For coordinate streaming benchmarks, use the included endpoint server instead:

```sh
python3 t/ngl_viewer_lab/stream_server.py --host 127.0.0.1 --port 8765
```

Then open `http://127.0.0.1:8765/t/ngl_viewer_lab/` and run the **Streaming
benchmark** panel. Current findings are recorded in
`STREAMING_BENCHMARK_RESULTS.md`.

## Current capabilities

- local PDB, mmCIF, SDF, MOL2, PQR, and GRO structure loading;
- local Gaussian cube loading;
- multiple selection-specific molecular representations;
- representation, coloring, opacity, and visibility controls;
- positive and negative volume isosurfaces;
- atom picking, centering, spinning, and clearing;
- GenApp-compatible structure payload preview;
- synthetic JSON and float32 binary coordinate-stream benchmarking.
