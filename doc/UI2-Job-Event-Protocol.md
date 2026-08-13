# UI2 Job Event Protocol

Status: adopted protocol version 1. Updated 2026-08-03 to describe the current
shared runtime implementation.

This protocol carries runtime information from a GenApp application driver to
UI2. It does not replace SASSIE `pgui()`. Scientific code may continue to put
ordinary text or structured records on its existing queue without knowing
which user interface consumes them.

The application driver is the semantic boundary:

```text
SASSIE pgui() -> driver queue parser -> normalized job event -> UI2 store -> React widget
```

Legacy html5 output remains an adapter fed from the same driver interpretation.
The new UI2 path must not use `_textarea`, DOM discovery, or widget injection as
its semantic model.

The current GenApp implementation advertises capabilities and consumes events
in `languages/ui2/add/js/ui2.js`; the generated message server maintains the
bounded journal through `languages/html5/util/job-event-cache.php`. Application
publishers own their envelopes and scientific topics.

## Layering

- Module JSON defines scientific inputs, stable outputs, executable identity,
  field choices, defaults, and validation semantics.
- View JSON defines presentation: sections, summaries, action placement,
  result grouping, prominence, tabs, expansion, and placement of standard
  runtime channels.
- Job events carry runtime values. They do not define layout.
- React renders module JSON plus view JSON plus the current job-event state.

Standard GenApp channels such as job lifecycle and the run log do not need a
module field. Module-specific scientific streams should use an existing output
id where possible. A genuinely new scientific output belongs in module JSON;
view JSON may place it but must not invent its meaning.

## Event Envelope

Each event is a JSON object:

```json
{
  "version": 1,
  "run": "job-uuid",
  "module": "monomer_monte_carlo",
  "sequence": 184,
  "timestamp": "2026-07-10T12:34:56.789Z",
  "channel": "metric",
  "topic": "coverage.rg",
  "operation": "append",
  "payload": {}
}
```

Required fields:

- `version`: protocol version; initially `1`.
- `run`: GenApp job UUID.
- `module`: module id.
- `sequence`: monotonically increasing integer within the run.
- `timestamp`: UTC timestamp from the driver.
- `channel`: semantic event class.
- `topic`: stable identity within the channel.
- `operation`: how the event changes channel state.
- `payload`: channel-specific JSON value.

Initial channels:

- `lifecycle`: submitting, running, completed, failed, or cancelled.
- `progress`: current phase, fraction, counts, and progress summary.
- `log`: chronological user-visible `pgui()` text.
- `summary`: terminal or checkpoint scientific summaries.
- `metric`: structured scalar or series observations.
- `plot`: Plotly initialization, append operations, and snapshots.
- `structure`: topology, coordinate frame, and structure snapshots.
- `artifact`: files or URLs available to the user.
- `warning`: recoverable warnings.
- `error`: failures and actionable diagnostics.

Initial operations:

- `append`: add ordered information.
- `replace`: replace the current topic value.
- `snapshot`: authoritative complete state for a topic.
- `complete`: mark a topic terminal, optionally with a final snapshot.
- `clear`: remove prior state for a topic at the start of a new run.

## Delivery Rules

- Sequence numbers provide ordering and duplicate suppression across WebSocket
  and polling delivery.
- UI2 ignores an event it has already applied.
- A sequence gap is recorded and may be recovered from a bounded server-side
  journal or a later topic snapshot.
- Live delivery may broadcast one `_job_event`.
- Polling and reattachment may return a bounded `_job_events` array.
- A newly submitted job retains strict ordering for individual live events. If
  its first delivery is a bounded journal whose initial prefix has expired,
  UI2 establishes its baseline at the first retained journal event and applies
  the contiguous retained range.
- The journal is a delivery and runtime-display cache, not authoritative
  scientific storage or a complete history.
- An event with `replay: false` is delivered live; the journal retains only an
  omitted marker carrying its sequence identity.
- Terminal lifecycle, errors, summaries, and artifact availability may remain
  in the bounded journal, but ordinary final outputs own completed-job state.
- Intermediate progress and structure previews may be coalesced when an
  authoritative later snapshot exists.
- Live-display sampling never changes the calculation or the complete stored
  scientific outputs.

## Capability Negotiation

UI2 submissions advertise reserved runtime metadata:

```json
{
  "_runtime_protocol": 1,
  "_runtime_capabilities": [
    "job-events",
    "plot-append",
    "structure-frames"
  ]
}
```

Legacy submissions omit these keys. A shared driver can therefore preserve its
existing legacy messages while emitting richer or higher-rate data only for a
capable UI2 client.

## Transport Requirements

- Job events use GenApp TCP messaging whenever the generated request supplies
  `_tcphost` and `_tcpport`. The Python helper uses `socket.sendall()` so a
  successful call represents a complete JSON write rather than a potentially
  partial `send()`.
- UDP remains available for existing small legacy messages and failure-isolated
  fallback traffic. It is not a valid transport for full molecular coordinate
  frames because a datagram cannot exceed roughly 65 KB.
- A structure-frame capability is useful only with the TCP message path. If
  that path is unavailable, dropping a live preview must never interrupt the
  calculation; the final DCD/PDB remains canonical.
- The replay cache is bounded below MongoDB's document limit. Large live
  messages must still be measured with realistic atom counts before enabling
  higher frame rates.

## Driver Contract

The reusable publisher owns envelope construction, sequence numbers,
timestamps, serialization, transport selection, and capability checks. The
module driver retains control of message interpretation.

Conceptual API:

```python
publisher.lifecycle(state, payload=None)
publisher.progress(topic, payload, operation="replace")
publisher.log(text, topic="run")
publisher.metric(topic, payload, operation="append")
publisher.plot(output_id, payload, operation="snapshot")
publisher.structure(output_id, payload, operation="snapshot")
publisher.artifact(output_id, payload)
publisher.warning(topic, payload)
publisher.error(topic, payload)
```

The legacy adapter emits the existing `_textarea`,
`_progress`, `progress_html`, declared output ids, and final stdout JSON. UI2
events are additive and capability-gated. The React path never depends on the
legacy adapter.

## Example Topics

Applications may use topics such as:

- `lifecycle/run`
- `progress/run`
- `log/run`
- `summary/run`
- `metric/coverage`
- `metric/rg`
- `plot/plotout4_stream`
- `structure/structure_ngl`
- `artifact/<declared-output-id>`

Additional SAS, P(r), energy, simulation-observable, and analysis series use
stable topics and declared output ids without changing the envelope or creating
new transport conventions.

## Plot Streaming

- Initialize a declared Plotly output with a snapshot.
- Add live points with `append` events and `Plotly.extendTraces`.
- Use `Plotly.react` for an authoritative snapshot or trace-set change.
- Keep the graph DOM node, CSS pane size, and `uirevision` stable.
- Batch updates when event frequency would otherwise make the browser lag.
- Treat journaled plot state as a bounded live-display aid. Final stdout JSON
  under the declared `plotly` output id is authoritative for completion and
  fresh-window reattachment; do not require event replay or a plot sidecar.

## Structure Streaming

- Send topology or an initial structure once.
- Send coordinate frames separately when atom identity and ordering are stable.
- Prefer numeric coordinate payloads or a binary-capable transport over
  repeatedly reparsing complete PDB documents.
- Coalesce intermediate preview frames if rendering falls behind; preserve the
  complete DCD/PDB trajectory as the canonical result.
- Do not auto-center or recreate the viewer for every frame.

The bundled NGL 0.10.4 implementation has now been verified against its own
trajectory path. UI2 updates the existing `Structure` with
`updatePosition(Float32Array)` and then calls
`component.updateRepresentations({position: true})`. Frames arriving faster
than browser repaint are coalesced to the newest pending preview. UI2 does not
reload topology, recreate the component, or auto-center after the initial
snapshot.

Coordinate append payloads use the declared structure output as their topic:

```json
{
  "channel": "structure",
  "topic": "structure_ngl",
  "operation": "append",
  "payload": {
    "atomCount": 1000,
    "frame_id": "17",
    "label": "Snapshot 17",
    "metadata": { "source_step": 50 },
    "coordinates": [0.0, 1.0, 2.0]
  }
}
```

`coordinates` is a flat xyz array whose length must equal `atomCount * 3`.
Atom identity and ordering must match the topology snapshot. JSON numeric
frames are the initial transport; a binary encoding may be added later without
changing the structure channel semantics.

## React Contract

The UI2 job-event store is independent of mounted DOM. It:

- stores events by run, channel, and topic;
- applies sequence-based deduplication;
- records sequence gaps and buffers later events until recovery;
- batches subscription notifications;
- retains state before a widget mounts;
- exposes immutable snapshots to React;
- resets explicitly when a new run begins.

React owns actions, status, progress, logs, summaries, plots, structures, and
artifact presentation. Runtime code must not create a module section or choose
the first compatible DOM element.

## Legacy Equivalence Gate

Before a shared driver refactor is accepted:

1. Capture representative current legacy payload sequences.
2. Exercise ordinary text, status, structured records, plots, completion, and
   failure.
3. Run the refactored parser through the legacy adapter.
4. Require equivalent legacy keys, ordering, final progress, and final stdout.
5. Generate html5 and verify no target output changed unintentionally.
6. Run an actual legacy job before deployment.

## Historical Vertical-Slice Evidence

The following evidence established protocol version 1 in July 2026. It is
historical validation, not the current module inventory or migration plan.

- The capability-off MMC driver characterization emits only the established
  legacy runtime keys and final stdout behavior.
- Capability-on runs add ordered job events while retaining the legacy adapter.
- A real 20-trial capability-on MMC run transported 59 ordered events over the
  GenApp TCP path, including four 6,730-atom coordinate frames, Plotly snapshot
  and append operations, all six exercised semantic channels, and 18 legacy
  textarea mirror messages. The scientific run completed with its final
  Plotly and NGL outputs intact.
- The server cache retains a replay journal bounded to 256 events and 8 MiB;
  polling and reattachment return the journal as `_job_events`.
- A browser benchmark using the bundled NGL 0.10.4 updated 1,000 atoms through
  120 frames while retaining one component, one topology load, and one initial
  auto-center. Mean coordinate-update work was approximately 0.20 ms per frame
  on the development machine. The benchmark is under
  `t/ngl_coordinate_stream_lab/`.
