# UI2 Runtime Contract ROA

Date: 2026-06-24

## Short Version

UI2 should not invent a new SASSIE execution path right now.

The right next target is:

1. Render a modern UI from the existing GenApp module/menu definitions.
2. Preserve the same field ids, repeat structures, matrix structures, hidden/system
   values, and submit payload shape.
3. Submit through the same generated GenApp runtime endpoint.
4. Let that endpoint call the existing module executable in `bin/`.
5. Let the existing driver call SASSIE, write progress/messages/output JSON, and
   participate in the normal job manager, project, file manager, and websocket
   machinery.

In plain speak: UI2 changes the front door and the room layout. It should not
replace the engine room unless a later, explicit architecture review says that
is worth doing.

## Why The Bin Drivers Still Matter

The `bin/` drivers are not just old launch scripts. For SASSIE-style GenApp
apps they are part of the application contract:

- they translate GenApp form JSON into scientific backend inputs
- they call the SASSIE Python code in the expected environment
- they own module-specific validation and compatibility behavior
- they know the current output JSON shape
- they participate in progress, messages, and runtime output conventions
- they preserve years of app-specific behavior that is not fully represented in
  the module JSON alone

Bypassing them would mean UI2 is no longer a new front end for the same GenApp
application. It would become a new application runtime. That may someday be
interesting, but it is not the right next move for this prototype.

## Existing Runtime Path To Preserve

For the HTML/PHP target, generated module endpoints follow this broad path:

1. Browser submits field values and system values such as `_uuid`, `_project`,
   `_window`, and login/session state.
2. Generated module PHP loads app configuration, module JSON, filter helpers,
   port helpers, and details helpers.
3. The runtime adds transport and app fields such as `_tcphost`, `_tcpport`,
   `_udphost`, `_udpport`, `_webroot`, `_application`, `_menu`, and `_module`.
4. It creates the project/run directory and job artifact files.
5. It writes `_input_<uuid>` and `_args_<uuid>`/command artifacts as needed.
6. It builds a command targeting the module executable from `bin/`.
7. It calls `details(...)` so field-level job details metadata is captured.
8. It records job start metadata.
9. It launches `util/jobrun.php`, which runs the command and captures stdout,
   stderr, status, and job lifecycle information.

UI2 does not need to duplicate all of that. It needs to submit compatible data
into that path.

## Runtime Surfaces UI2 Must Respect

UI2 form generation must preserve:

- canonical field ids from module JSON
- submitted values for normal scalar fields
- checkboxes and listbox values exactly as the drivers expect them
- repeaters, nested repeaters, and table-like repeaters
- `integerpair`/matrix fields as submitted arrays or values matching legacy
  payload conventions
- hidden/system fields used by generated runtime logic
- `_allformdata` behavior where modules depend on whole-form context
- hook-backed buttons and field-driven callbacks
- submit/reset/default handling
- file fields, local upload, server browse, and project-relative paths
- `run_name` and field-level `details` metadata for Job Manager display
- module-level `resource`, `jobweight`, `submitpolicy`, cache, and notification
  behavior
- progress, html, textarea, plot, image, NGL/JSmol, and dynamic-output fields
- job reattach and cached-output conventions
- top-level user/project/session context used by settings, jobs, files, docs,
  feedback, and help

The implementation detail can differ. The submitted contract cannot casually
differ.

## What UI2 Can Modernize Safely

UI2 can improve the user experience without changing backend semantics:

- modern controls for text, number, checkbox, select, file, and textarea fields
- clearer sections, tabs, collapsible groups, and matrices
- better first impression and responsive layout
- a top bar for project, jobs, files, settings, help, and logoff
- dark-mode-aware styling
- sidebar hide/auto-hide options
- cleaner handling of legacy spacer labels and section labels
- admin/dev-only display of raw field ids and types, hidden during normal use

These are front-end responsibilities. They should remain front-end
responsibilities.

## Things That Would Be A Bigger Architecture Change

These should not be folded into the current UI2 renderer work by accident:

- replacing module `bin/` drivers with direct SASSIE calls
- changing the backend payload contract
- changing how GenApp stores job records
- changing project directory conventions
- changing file manager semantics
- changing websocket/TCP/UDP progress protocols
- requiring React/Vite or another application framework as the runtime baseline
- changing shared GenApp validation in a way that affects html5, Qt, Swift, or
  other targets without tests proving compatibility

Any of those may be valid future work, but they need their own design review.

## Recommended Next Runtime Proof

The next proof should be small and direct:

1. Pick `data_interpolation` as the first submit-capable UI2 module.
2. Generate/render its UI2 page from the same module JSON.
3. Submit through the existing generated endpoint, not a new backend.
4. Confirm the generated job directory contains the same kind of artifacts as
   legacy: `_input_<uuid>`, `_args_<uuid>` or equivalent command data,
   `_cmds_<uuid>`, stdout/stderr capture, and job status.
5. Confirm the existing driver runs and returns the expected runtime JSON.
6. Confirm Job Manager sees the job.
7. Confirm File Manager can see/download the output.
8. Confirm progress/output placeholders can be updated through the existing
   runtime channels, even if the first UI2 display is simple.

After that:

- try `sascalc` for matrix/repeater/scientific complexity
- try `multi_component_analysis` for branching mini-app behavior
- try a module with richer runtime outputs

## Test Guardrails To Add

Useful automated coverage should include:

- a UI2 generation test that proves UI2 can be generated without modifying
  html5 output
- a payload-shape test for representative fields: scalar, checkbox, listbox,
  file, repeater, nested repeater, and `integerpair`
- a backend contract test showing a UI2-style payload can still enter the
  existing generated submit endpoint
- a details metadata test proving Job Manager details survive from module JSON
  into stored job metadata
- a negative test that prevents UI2-only experiments from weakening shared
  module JSON validation
- a Zazzie directive check that prevents accidental title/theme/docs/language
  drift in legacy deploys

The guiding rule is simple: UI2 may add a new target, but it must not quietly
change the contract shared by existing targets.

## ROA

The current best architecture is a modern UI2 front end that is GenApp-native,
not SASSIE-direct. It should use the existing module JSON and driver/runtime
contract first. That keeps UI2 honest: if it cannot submit normal GenApp
payloads, render repeaters, respect field ids, and display runtime outputs, it
has not yet proven itself as a GenApp target.

The design can still evolve. UI2 may eventually need a small explicit view
schema above the old field list. It may eventually benefit from shadcn-like
component conventions, a stronger form state model, or richer output widgets.
But the first runtime proof should be conservative: same app semantics, same
drivers, same job lifecycle, better interface.
