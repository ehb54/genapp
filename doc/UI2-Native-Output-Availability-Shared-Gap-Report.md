# Native UI2 output availability

Owner approval: Joseph Curtis approved the exact ten-file cross-repository
manifest, including this shared-core change, on October 30, 2026.
Application evidence: https://github.com/ehb54/zazzie/issues/339.

## Reproduction and gap

A neutral module declares primary_plot and optional_plot as ordinary outputs.
Its view places optional_plot in a results group with visibility: available.
A completed payload containing only primary_plot leaves the optional native row
and its runtime placeholder visible. React consumes the existing availability
snapshot and hides that group. Native renderSection/renderField previously
rendered every static output row without consuming this metadata.

The reproduction uses ordinary fields and existing view metadata; it needs no
application names, scientific branching, new schema, driver flag, or transport.
The application already omits the optional output correctly. Changing its
producer or hiding an output by scientific identity would duplicate presentation
policy and would not fix native fallback for other opted-in applications.

## Contract and implementation

Native UI2 consumes results.groups[].visibility: available. Static rows in an
available group remain hidden until any output in that group is marked available
in the existing runtimeOutputAvailability snapshot. An explicit or default
visibility group keeps its member rows visible; an output shared by groups is
visible when any containing group permits it. Unassigned outputs retain their
normal placeholder. Availability remains sticky within the current context,
matching React; omitted keys in an incremental payload are not removals.

Refresh native rows after mounting and when availability changes, before output
rendering. Resetting or switching the module/job context clears availability,
so historical or positive-only final JSON cannot inherit a prior job's companion.
Use the actual mounted React root to distinguish active React from native
fallback even when the view still requests React. Do not change React rendering.
Dynamic rows retain their existing items lifecycle, including items: [] clearing.
Field repeat visibility continues to operate independently. This change does not
add native group-repeat layout behavior.

Scientific values, output IDs, saved JSON, runtime transport, and HTML5 remain
unchanged. SASSIE work is not required; all scientific values already exist.

## Validation and rollback

Neutral runtime tests cover absent/present optional outputs, multi-output and
shared groups, default/unassigned controls, job reset and stale payloads,
historical omission, active React exclusion, and payload preservation. Existing
dynamic-output tests cover population, clearing, and repopulation. The generated
neutral UI2 fixture carries both an available static group and default controls;
UI2 generation and HTML5 compatibility tests remain required local checks.

Local checks do not establish deployed acceptance. After deployment, reattach
the existing signed and positive-only jobs through native UI2, record IDs and
fallback method, verify the optional row is absent for positive-only output,
verify signed plots still render, and log out. Rollback is to revert the scoped
native availability change; stored results need no conversion or regeneration.

## Local implementation evidence — October 30, 2026

On macOS with Node v24.18.0 and Perl 5.34.1:

- `node --check languages/ui2/add/js/ui2.js`: passed.
- `UI2_NATIVE_AVAILABILITY_ONLY=1 prove t/unit_tests/ui2_runtime_logic.t`:
  passed the focused availability regression block, including dynamic clearing.
- `prove t/unit_tests/ui2_views.t t/unit_tests/html5_language_overrides.t
  t/html5_assembly.t`: all three files passed in the combined local run.
- `prove t/unit_tests/language_filter.t`: passed all 25 assertions.
- The complete `ui2_runtime_logic.t` suite is not green. It fails at the existing
  assertion "non-opted-in UI2 preserves its original display path", which
  requires object identity although plotlyDisplayFigure returns a detached copy.
  An isolated copy of both the HEAD test and HEAD runtime reproduced the same
  failure. The unrelated assertion remains unchanged. A temporary diagnostic
  value-comparison correction also encountered an existing Chart Editor handoff
  test failure (no stored snapshot), reproduced without the new regression block;
  no Chart Editor behavior or assertions were changed for this task.

These are local Mac results, not authoritative Linux runtime or deployed browser
acceptance. No deployment, login, publication, commit, or push was performed.
The existing signed job is `416c1698-d74c-4ee0-9320-8a7391ce594c`; the existing
positive-only job is `9c4c4f68-407b-4b3b-9391-1e0097549940`. Prior native acceptance
used a temporary browser request block for `ui2/react/ui2-react.js`; that block
was removed and the account logged out. These jobs must be rechecked after the
fix is deployed before sending a passed-acceptance handoff.
