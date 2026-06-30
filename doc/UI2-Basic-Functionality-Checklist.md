# UI2 Basic Functionality Checklist

Date: 2026-06-29

This checklist is the working audit spine for the UI2 prototype. UI2 should be
checked against existing GenApp behavior before new behavior is invented. For
browser/runtime behavior, read the legacy `html5` code and the current local
wiki first, then patch UI2.

Related notes:

- `doc/UI2-Runtime-Contract-ROA.md`
- `doc/UI2-Legacy-Guardrails-ROA.md`
- `doc/UI2-Shared-Change-Review-ROA.md`
- `doc/UI2-Renderer-ROA.md`

Useful wiki entry points:

- `../genapp.wiki/Reference-Jobs.md`
- `../genapp.wiki/Reference-Dynamic-Outputs.md`
- `../genapp.wiki/Reference-Module-JSON.md`
- `../genapp.wiki/Reference-Directory-Layout.md`
- `../genapp.wiki/Reference-Plotly.md`
- `../genapp.wiki/Reference-Themes.md`

## Status Legend

- `Pass`: tested enough for the current prototype.
- `Partial`: works in at least one path, but needs broader testing or parity.
- `Gap`: known missing or incorrect behavior.
- `Untested`: not audited yet.
- `Risk`: shared behavior or legacy-sensitive behavior; verify carefully.

## Audit Matrix

| Area | Legacy / Wiki Reference | UI2 Status | Manual Check | Automated Coverage | Known Gaps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| UI2-only generation | `bin/genapp_run.pl`, `doc/UI2-Legacy-Guardrails-ROA.md` | Pass | `genapp --language ui2` should generate only UI2 output. | `t/unit_tests/language_filter.t` | Keep verifying deploy scripts do not regenerate html5 by accident. | P0 |
| Legacy isolation | `languages/html5/*`, `tools/check_zazzie3_directives.sh` | Risk | Confirm html5 title, theme selection, docs links, splash, Job Manager Details after shared changes. | Legacy guardrail tests; directive checker | Shared GenApp or app JSON changes can still affect legacy. | P0 |
| Menu rendering | `menu.json`, `Reference-Menu-JSON.md` | Partial | All active Zazzie menu entries should show under expected groups. | UI2 generation/runtime tests | Admin section present but not audited. | P0 |
| Module rendering | `modules/*.json`, `Reference-Module-JSON.md` | Partial | Load every active module once and compare visible first-pass structure to legacy. | UI2 runtime logic tests | Output-only/system modules need separate treatment. | P0 |
| Text/integer/float/listbox controls | `Reference-Module-JSON.md` | Pass | Verify scalar fields match module JSON defaults and valid types. | `t/unit_tests/ui2_runtime_logic.t` | Some module JSON type mistakes may still exist in app repos. | P1 |
| Checkbox/button controls | `Reference-Module-JSON.md`, legacy JS | Partial | Confirm checkbox/listbox gates and hook-backed buttons preserve backend values. | Repeater/runtime tests | Hook-backed buttons need a focused pass. | P1 |
| Conditional visibility | Legacy generated JS repeat handling | Partial | Compare branch switches in `multi_component_analysis`, `sas_assembly`, `pdbrx`, `contrast_calculator`. | Repeater tests, UI2 helper tests | More modules need branch-by-branch review. | P0 |
| Repeaters | `../genapp.wiki/Archive-Trac-docs-repeat.md`, legacy generated JS | Partial | Counters should add/remove visible rows and suppress zero-count rows. | high-risk repeater tests | Nested repeaters still need broader runtime review. | P0 |
| Integerpair / matrix fields | `../genapp.wiki/Archive-Trac-docs-integerpair.md` | Partial | Confirm matrix-style entries render, hide at zero count, and submit matching legacy shape. | high-risk feature tests | Need payload comparison against legacy submit data. | P0 |
| File inputs: local/server | `Archive-Trac-fieldnotes-lrfile.md`, `Archive-Trac-fieldnotes-rfile.md` | Partial | Local browse and server browse should both set visible filename and submitted value. | UI2 runtime logic tests | Need systematic type-by-type check for `file`, `rfile`, `lrfile`, `rpath`. | P0 |
| Submit/reset | Legacy generated module PHP/JS | Partial | Submit through existing endpoint; reset clears inputs/output like legacy. | Runtime helper tests | Reset needs broader module coverage. | P0 |
| Existing bin/driver path | `doc/UI2-Runtime-Contract-ROA.md` | Pass | Confirm jobs run through existing module executable in `bin/`. | Backend contract tests | Do not bypass drivers without a separate architecture review. | P0 |
| Runtime progress | `Reference-Dynamic-Outputs.md`, legacy output renderers | Partial | Progress bar updates during and after job. | None specific yet | Need modules with long-running progress. | P1 |
| Runtime html/textarea outputs | Legacy output renderers | Partial | Text should preserve canonical runtime stream, including start/end blocks. | UI2 runtime logic tests | Need more output types and append-style outputs. | P1 |
| Plotly outputs | `Reference-Plotly.md`, legacy Plotly renderer | Partial | Plot renders, modebar works, chart editor opens. | Basic JS syntax/runtime tests | Chart editor sizing/theme/polish not final. | P1 |
| Dynamic/grouped outputs | `Reference-Dynamic-Outputs.md` | Untested | Modules with dynamic output groups should create child output instances at runtime. | Existing html5 tests only | UI2 dynamic output renderer parity is not established. | P0 |
| Image/file/NGL/JSmol outputs | `Reference-Plots-and-Viewers.md`, `Reference-NGL.md` | Gap | Output renderers should show actual assets/viewers, not raw JSON. | Existing html5 tests only | MMC `structure` output currently renders raw JSON; likely requires separate renderer work. | P1 |
| Job Manager list | `Reference-Jobs.md`, legacy `sys_job_manager` implementation | Partial | Logged-in user should see jobs and server date. | None specific yet | Legacy has a `Details` column; UI2 currently omits it. Job Manager should open as a utility splash/modal so users can inspect jobs without losing the active module/job context. UI2 should not claim parity until filters/actions pass. | P0 |
| Job Manager filters | `Reference-Jobs.md`, legacy Job Manager code | Partial | Running-only, completed-window, project, and module filters should refresh the list canonically. | None specific yet | Completed-window, project, module, and no-running-jobs filter cases manually work. Server date display differs from legacy. Need a real running-job case; MMC or another long-running live job is required. | P0 |
| Job Manager attach | `Reference-Jobs.md`, legacy attach code | Partial | Attach should restore inputs, file names, output state, and job UUID context. | `t/unit_tests/ui2_runtime_logic.t` | `data_interpolation` completed-job attach restores inputs and outputs. Status reports complete but does not visibly show attached UUID. Needs repeaters/files/matrices/old jobs. | P0 |
| Job Manager actions | `Reference-Jobs.md`, legacy Job Manager code | Untested | New, cancel, delete, unlock should match legacy behavior and permissions. | None specific yet | Cancel may be documented as not currently functional. | P0 |
| File Manager browse | `Reference-Directory-Layout.md`, legacy file manager code | Partial | User tree should list project-relative files and folder details. | None specific yet | Needs project/path parity with legacy. File Manager should open as a utility splash/modal so browsing files does not reset or replace the active module/job context. | P0 |
| File Manager download | Legacy file manager code | Gap | Selected files/folders should return the same link/package behavior legacy returns. | None specific yet | Current behavior needs path/link/package investigation. | P0 |
| Login/session/user space | Legacy splash/login/settings code | Partial | Login/logout should use same user/session store as legacy. | None specific yet | Full splash/registration flow not implemented. First site entry should eventually show a legacy-like splash/login/register/docs surface. | P0 |
| User settings/config | Legacy user configuration code, `Reference-Themes.md` | Partial | Project, theme/help settings should follow legacy expectations. | Directive guardrails | UI2 user options need explicit config model later. Settings should behave as a utility splash/modal rather than replacing active module state. | P1 |
| Admin: Job Monitor | Legacy admin module | Untested | Admin-only access, filters, outputs, and actions should match legacy. | None specific yet | Not explored. | P0 |
| Admin: Integrity Check | Legacy admin module | Untested | Admin-only access and output/action behavior should match legacy. | None specific yet | Not explored. | P0 |
| Admin: Users | Legacy admin module | Untested | User listing should respect permissions and output layout. | None specific yet | Not explored. | P0 |
| Admin: User Management | Legacy admin module | Untested | User create/edit/delete/permission behavior should match legacy. | None specific yet | High risk; inspect legacy before clicking destructive actions. | P0 |
| Admin: Job History | Legacy admin module | Untested | History filters and actions should match legacy. | None specific yet | Not explored. | P0 |
| Websocket/status indicator | Legacy footer/status code | Partial | Indicator should reflect live websocket state, not only render visually. | None specific yet | Connection behavior needs real test. | P1 |
| Docs/feedback/help tabs | Legacy side tabs and docsbaseurl | Gap | Docs, feedback, and roll-over help should be available without cluttering audit views. | Directive guardrails | Legacy has right-side roll-out Docs and Feedback tabs. UI2 should restore these affordances later; roll-over help is intentionally disabled during visual audit. | P2 |
| Views layer readiness | `doc/UI2-Renderer-ROA.md`, `GenApp-Architecture-Audit.md` | Partial | UI2 should work from legacy module JSON before optional `views/` hints. | `t/unit_tests/ui2_views.t` | Do not start views until basic runtime parity is clearer. | P1 |

## Immediate Work Order

1. Read the legacy Job Manager and File Manager code before changing UI2 again.
2. Add focused tests for the current known failures:
   - attach restore updates file fields after a saved-job attach
   - Job Manager filter values are sent in the same shape legacy expects
   - File Manager download response is converted into the same user-facing link
     behavior as legacy
3. Fix Job Manager filters and attach parity.
4. Fix File Manager download/path parity.
5. Audit admin modules in read-only mode first:
   - Job Monitor
   - Integrity Check
   - Users
   - User Management
   - Job History
6. Return to output renderer polish after system modules stop hiding basic
   functional gaps.

## Notes

- Do not test destructive admin actions against production-like data without a
  deliberate plan.
- Do not treat a visible button as working until the backend result and legacy
  behavior have been checked.
- Do not patch UI2 from screenshots alone when legacy code or wiki behavior is
  available.
- Keep UI2 deploys target-filtered unless explicitly testing legacy.
- Top-bar utilities such as Jobs, Files, Settings, Docs, and Feedback should not
  discard the active module/job state. Legacy uses splash-style utility windows;
  UI2 should preserve that workflow even if the visual implementation is modern.
- MMC `structure` output rendering is a separate output renderer gap, not part
  of the top-bar utility workflow.
