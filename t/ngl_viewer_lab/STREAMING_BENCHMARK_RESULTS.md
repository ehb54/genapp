# Coordinate Streaming Benchmark Results

Date: 2026-07-11

This lab measured live coordinate updates through the bundled GenApp NGL 0.10.4
viewer. The page was served from `zazzie` and observed in the local browser over
an SSH tunnel:

```sh
python3 t/ngl_viewer_lab/stream_server.py --host 127.0.0.1 --port 8765
ssh -N -L 9876:127.0.0.1:8765 zazzie
```

The benchmark loads a synthetic CA-only PDB from the serving host, fetches
coordinate frames from the same host, and updates NGL in place with
`structure.updatePosition()` plus `component.updateRepresentations({position:
true})`.

## Remote Results

The first benchmark pass used synthetic topology and synthetic coordinates. A
follow-up pass used the real `hiv1_gag_charmm27.pdb` topology and corrected the
frame endpoint so streamed frames are displaced from the real PDB coordinates.
An intermediate bad run loaded the real PDB but streamed synthetic grid
coordinates; those values were discarded because the visual structure became a
grid of dots rather than the molecule.

| Atoms | Frames | Transport | Representation | Transferred | Fetch avg | Parse avg | NGL update avg | Notes |
| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| 6,730 | 5 | JSON float array | point | 1.78 MiB | 219 ms | 0.70 ms | 0.56 ms | HIV-sized baseline. |
| 6,730 | 5 | float32 binary | point | 0.39 MiB | 167 ms | 0 ms | 0.42 ms | Same viewer path, far less payload. |
| 50,000 | 3 | JSON float array | point | 7.90 MiB | 747 ms | 7.97 ms | 3.43 ms | Still usable, near 1 Hz over this path. |
| 50,000 | 3 | float32 binary | point | 1.72 MiB | 304 ms | 0 ms | 2.20 ms | Comfortable for every-few-seconds updates. |
| 100,000 | 3 | JSON float array | point | 15.84 MiB | 1095 ms | 12.27 ms | 4.27 ms | Usable for slow updates, wasteful payload. |
| 100,000 | 3 | float32 binary | point | 3.43 MiB | 294 ms | 0 ms | 2.43 ms | Good default for large all-atom previews. |
| 200,000 | 3 | float32 binary | point | 6.87 MiB | 567 ms | 0 ms | 5.67 ms | Upper-end test remained stable. |
| 50,000 | 3 | float32 binary | line | 1.72 MiB | 234 ms | 0 ms | 6.30 ms | Representation geometry starts to matter. |
| 50,000 | 3 | float32 binary | backbone | 1.72 MiB | 220 ms | 0 ms | 11.40 ms | Still acceptable for seconds-level cadence. |
| 12,500 | 3 | float32 binary | ball+stick | 0.43 MiB | 162 ms | 0 ms | 2.33 ms | Reduced proxy for a requested 100k-atom system. |
| 12,500 | 3 | JSON float array | point | 1.98 MiB | 205 ms | 1.23 ms | 0.57 ms | Reduced proxy for a requested 100k-atom system. |

## Real HIV1 Gag PDB Results

These runs loaded `hiv1_gag_charmm27.pdb` from the server and streamed
coordinate frames displaced from the actual PDB coordinates.

| Topology | Atoms | Frames | Transport | Representation | Load/setup | Transferred | Fetch avg | Parse avg | NGL update avg |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| full HIV1 Gag | 6,730 | 5 | float32 binary | point | 945 ms | 0.39 MiB | 356 ms | 0 ms | 1.30 ms |
| full HIV1 Gag | 6,730 | 5 | float32 binary | cartoon | 376 ms | 0.39 MiB | 173 ms | 0 ms | 6.02 ms |
| full HIV1 Gag | 6,730 | 5 | JSON float array | point | 413 ms | 1.83 MiB | 177 ms | 1.98 ms | 0.60 ms |
| HIV1 Gag CA/P reduced | 431 | 5 | float32 binary | point | 145 ms | 0.02 MiB | 178 ms | 0 ms | 0.18 ms |
| HIV1 Gag CA/P reduced | 431 | 5 | float32 binary | backbone | 168 ms | 0.02 MiB | 176 ms | 0 ms | 0.54 ms |
| HIV1 Gag CA/P reduced | 431 | 5 | JSON float array | point | 160 ms | 0.12 MiB | 126 ms | 0.12 ms | 0.20 ms |

The reduced topology keeps only protein `CA` and nucleic-acid `P` atoms from the
same real PDB. For this all-protein HIV1 Gag example, that gives 431 atoms.

## Interpretation

- NGL in-place coordinate updates are not the limiting factor for point, line,
  or backbone previews. Network transfer and server-side payload generation
  dominate in this benchmark.
- JSON arrays work, but they are roughly 4-5x larger than raw float32 frames and
  add browser parse cost. JSON is acceptable for early compatibility, but should
  not be the long-term high-throughput transport.
- Raw float32 binary frames are the best next target. They match the preferred
  SASSIE-wide float32 coordinate direction, avoid JSON parse overhead, and make
  100k-200k atom updates every few seconds realistic on the observed path.
- Reduced-coordinate previews are extremely attractive. A CA/P proxy for a
  100k-atom system was in the 12.5k-atom range here and stayed comfortably
  interactive. For the actual HIV1 Gag PDB, a CA/P-only topology reduced 6,730
  atoms to 431 atoms and brought per-frame NGL update time below 1 ms.
- Browser retention should remain memory-budgeted rather than frame-count
  limited. The active-tab trajectory requirement fits this model: keep as much
  as the budget allows, always retain the latest frame, and do not promise old
  job reattachment.

## Recommendations

1. Keep NGL as the production baseline for this study. The existing GenApp/Zazzie
   docs already prefer NGL over legacy JSmol, and the benchmark confirms NGL can
   accept live coordinates in place.
2. Add adaptive cadence around telemetry already exposed by UI2:
   `lastRenderMs`, retained bytes, dropped frames, and queue age. Start at
   2-5 seconds for small systems, then slow down or switch to reduced preview
   when payload size or queue age grows.
3. Implement a binary float32 coordinate-frame transport next to the current JSON
   event path. Keep JSON as a compatibility/control case until binary is wired
   into the runtime event channel.
4. Add a module-side coordinate selector for preview mode: all atoms, protein
   CA, nucleic-acid P, or other viewer-safe backbone proxies.
5. Treat Mol* as a follow-up comparison, not a blocker. It may be attractive for
   modern rendering and trajectory abstractions, but it is not currently bundled
   in this GenApp path and would need an integration spike comparable to the NGL
   work already completed here.

## Density Preview Process

Density preview should run as a driver-side child process. The simulation module
should only offer lightweight inputs at a throttled cadence, while the driver
starts one pending density build at a time, drains completed preview payloads,
and publishes them as structure events. This avoids slowing the MMC accept loop
and avoids Python thread/GIL coupling for expensive density work.
