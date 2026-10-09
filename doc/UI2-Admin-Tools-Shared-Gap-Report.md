# UI2 administrator tool gaps

Audit: 2026-10-09. Implementation plan and exact manifest approved by Joseph Curtis.

## Evidence and ownership

The deployed SASSIE2 administrator tools return operational results. On deployed
SASSIE3/UI2, User Directory and Job History return tables through the existing
submission path, while Job Monitor returns legacy `plot2d` data that UI2 cannot
render. Account Administration already works as an embedded page and is excluded.
The ordinary module shell shows redundant Inputs/Outputs titles and shortcuts for
these tools. UI2 previously ignored the directory's autosubmit/Refresh/noreset
metadata. These are generic renderer/lifecycle gaps, not SASSIE scientific gaps.

A separate shared PHP safety defect interpreted the unchecked string `"false"`
as true for integrity repairs. The read-only audit consequently removed nine stale
SASSIE3 running records; the user was informed. No process kills were reported.
The corrected parser and repair verification are tested against isolated fake
processes and databases, never against production repair targets.

## Reused contracts and bounded changes

- An explicit `layout: "tool"` view uses native UI2 fields/output widgets and the
  same form submission, websocket/polling, cancellation and reattachment paths.
  There are no application/module-id branches or another runner.
- Tool presentation suppresses canonical section titles, shortcuts, field counts
  and empty input messages. Existing ordinary views retain their shell.
- `submit_label` and `noreset` are generic module metadata. Autosubmit is confined
  to opted-in tools with no visible inputs. Reattachment does not auto-submit.
- Optional `tool.stopLabel` opts into Start/Stop lifecycle. An owned run is tracked
  per module/login in browser memory to prevent duplicate starts and restore
  polling on navigation. A fresh window still uses normal Job Manager reattachment.
- Monitor `plot_format: "plotly"` explicitly requests ordinary Plotly operational
  series, preserving ids and values. The default remains legacy `plot2d`.
  Every series is bounded to the existing 240 samples; display geometry and style
  belong to UI2. This does not introduce scientific producers or plot replay.
- Integrity reports declare persistent diagnostic output. False checkbox forms
  never repair; malformed forms and failed initial database scans fail closed.
  Successful DB removal is reread;
  process signal failures and DB verification failures remain actionable errors.
- History validates both dates and their order and uses an exclusive next-midnight
  end. `findOne` determines whether a running record exists; stale jobs use their
  last recorded time rather than the current time. Existing duration/SU units and
  per-user rounding are preserved. Empty databases return zero totals.

## Validation boundaries

`admin_methods.t` substitutes all process, database, resource-command and ZMQ
operations in disposable PHP copies. It exercises boolean variants, authorization,
failed repairs, both monitor formats, exact operational values, sample bounds,
date errors, midnight exclusion, stale status and known totals. UI2 runtime tests
use neutral tool ids; generation tests preserve generic tool view metadata.
Application tests cover the four authored overrides and views.

The running monitor is a streaming administrative tool. It does not acquire a
new completed-job replay store or durable plot snapshot on cancellation. Historical
monitor reattachment is therefore not a claim of this change. Read-only live
acceptance requires fresh account authorization after deployment. Repairs require
separate explicit authorization and are excluded from normal acceptance.
