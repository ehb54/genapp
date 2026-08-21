# UI2 Initial Results Visibility Shared-Gap Report

Status: approved for implementation by `ehb54/zazzie#235`.

## Symptom and smallest application-level attempt

On a newly loaded React scientific workbench, the generic results pane reserves
space and renders the view-declared progress card and runtime log before any run
exists. SASSIE-web has 33 React workbench views that declare those elements.

Application views can hide an individual result group until an output becomes
available, but they cannot express whether UI2 has accepted a submission,
reattached a job, or reset a run. Marking every result group `available` would
still leave the pre-run progress and log cards visible, duplicate lifecycle
policy across applications, and fail for legacy tab declarations.

## Neutral reproduction

The `t/fixtures/apps/ui2_views` `workbench_layout` fixture is a generic React
workbench with ordinary input fields, declared result groups, a Plotly output,
an NGL output, and a dynamic output. It contains no SASSIE module or scientific
identifiers.

## Existing contracts and proposed behavior

No schema, transport, output, or reattachment contract changes are needed. The
existing UI2 bridge already exposes generic submission state, submitted or
reattached run context, per-output availability, action review, and scenario
review state.

React composes those existing signals as follows:

- A fresh configuration view with no run context and no available output omits
  the results pane and uses one input column.
- A pending submission or established run context shows the pane, including
  progress and runtime-log presentation.
- A pre-submit action or scenario review, or a genuinely available output,
  may show the pane without implying that a run has started.
- Reset returns to the configuration-only presentation after the existing
  runtime context and output availability clear.

This is generic UI2 presentation behavior: it does not inspect application,
module, output, or scientific-role identifiers.

## Consumers, compatibility, and rollback

React workbenches are the opted-in consumers. The native UI2 renderer is the
non-opted-in control and remains unchanged; HTML5 remains unchanged. Plot and
structure events that arrive while an availability-gated native host is absent
are retained in a bounded per-output queue. React notifies the bridge after
mounting an output group, and UI2 replays those retained events in order. This
preserves the initialization snapshot required by later append events;
completed and reattached output rendering still uses the established final
output path.

Rollback is a source and generated-asset revert of the React visibility helper
and workbench composition. It leaves job execution, polling, output payloads,
saved-job reattachment, and application view metadata untouched.

## Approval

The implementation authority is the request to carry out this report's bounded
plan for `ehb54/zazzie#235`. The approved file manifest and deterministic scope
guard record are maintained by the corresponding implementation task.
