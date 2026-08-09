# Next-job environment settings

Applications may opt into a narrowly declared diagnostic setting that applies a
fixed environment assignment to exactly one subsequently accepted job.  This is
for short-lived troubleshooting, not a general user environment editor.

## Declaration

An application enables the setting with these directives:

```json
"nextjobenvironment" : "true",
"nextjobenvironmentid" : "diagnostic_logging",
"nextjobenvironmentvariable" : "APP_LOG_LEVEL",
"nextjobenvironmentvalue" : "DEBUG"
```

The id, variable, and value are application-owned declarations.  The browser
only arms or clears the fixed declaration; it never supplies an environment
variable, value, shell fragment, or logging level.

## Lifecycle and safety

The setting is session-scoped to the current browser window.  It is not stored
in the user record and does not affect other windows, devices, or later jobs.
When an armed job reaches command creation, GenApp serializes competing
submissions through the session lock, records the fixed setting id with the
job, and clears the setting only after the job record is created successfully.
Failures before that point leave it armed.

The generated endpoint validates the declared identifier and shell-safe fixed
assignment.  It rejects adapters that cannot apply the assignment at the job
process boundary rather than silently claiming the setting took effect.

This contract is intentionally generic.  Applications own the diagnostic
meaning, environment assignment, and any scientific/runtime policy behind the
setting. GenApp supplies the generic Settings Manager label and safety text.

Related selected-job feedback attachments are governed separately by
`doc/Feedback-Job-Attachments.md`. They are optional bounded diagnostics
delivery and do not affect the one-job environment lifecycle.
