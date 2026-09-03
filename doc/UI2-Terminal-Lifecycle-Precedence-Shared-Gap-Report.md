# UI2 terminal lifecycle precedence shared-gap report

## Application symptom and smallest application-level attempt

SASSIE-web Contrast Variation Analysis deliberately refuses a rank-deficient
ensemble fit after preserving its single-frame results and a durable explanatory
report. The application driver emits a structured terminal `failed` lifecycle
event. Commit `ef4d703` removed a redundant application-level backend-failure
banner, but the UI2 run cue still reports `Run completed` because the generic
legacy `_status: complete` from the outer GenApp command replaces the earlier
structured failure.

The application cannot correct this through view metadata. It already emits the
required terminal failure event through the established driver runtime. Adding
module-specific wording or identifiers to UI2 would violate the shared-core
boundary.

## Application-neutral reproduction

For any capability-aware application:

1. apply a valid terminal lifecycle event whose state is `failed`;
2. apply the completed result payload containing legacy `_status: complete`;
3. observe that the current event store replaces `failed` with `complete`.

The same conflict applies to a structured `cancelled` event. No scientific or
application-specific field is required to reproduce it.

## Why existing contracts cannot express the correction

The driver event is already correct, ordered, capability-gated, and retained in
the bounded journal. Final output fields remain authoritative for scientific
results, but legacy `_status: complete` describes completion of the outer
command path rather than the scientific outcome encoded by the structured
lifecycle event. Neither application view metadata nor an additional output
field controls UI2's lifecycle arbitration.

## Proposed generic contract

When UI2 has applied a structured terminal `failed` or `cancelled` lifecycle
event, a later legacy completion status must not replace it. Legacy status
remains authoritative for applications that do not emit job events. A later
legacy failure may still replace completion when result retrieval or access to
saved outputs fails.

This is a precedence rule inside the existing protocol and event store. It adds
no envelope field, capability, transport, replay store, application identifier,
or scientific vocabulary.

## Consumer, control, compatibility, and rollback

- Opted-in consumer: any application driver using protocol version 1 with the
  `job-events` capability, including Contrast Variation Analysis.
- Non-opted-in control: a legacy-only driver continues to derive lifecycle from
  `_status` exactly as before.
- Compatibility: final stdout JSON, declared outputs, polling, WebSocket
  delivery, reattachment, native UI2, and React workbench inputs remain
  unchanged. HTML5 is not changed.
- Rollback: revert the event-store precedence condition and its neutral test;
  no data or schema migration is required.

## Approval

The application owner approved the coordinated issue #472 implementation plan,
including the generic GenApp UI2 correction, on 2026-09-03.
