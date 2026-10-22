# File-transfer audit contract

Status: approved opt-in GenApp web-runtime contract (2026-10-08).

## Purpose and shared-gap record

NIST requires an authenticated record of uploads and downloads for its SASSIE
deployment. Before this contract, a generated application knew the user who
selected a file, while the web-server access log knew whether bytes were served;
neither record alone could answer both questions. The neutral reproduction is
any generated application that accepts a browser upload and later offers a
same-origin result file for download. Existing module metadata and presentation
settings cannot join those two records.

The repository owner approved a generic, disabled-by-default runtime capability
on 2026-10-08. It is not SASSIE-specific and does not change scientific code,
file contents, output schemas, or non-opted-in applications. Rollback consists
of removing the application directive and the `audit.file_transfers` setting.

## Enabling the capability

Both controls are required:

- generation directive `ui2_file_transfer_audit` must be true so UI2 routes
  eligible same-origin result links through the audit endpoint;
- deployed `appconfig.json` must set `audit.enabled` and
  `audit.file_transfers` to true so the server emits events.

Example deployment setting:

```json
{
  "audit": {
    "enabled": true,
    "file_transfers": true,
    "destination": "syslog"
  }
}
```

`destination` may be `syslog` or `error_log`. The latter is useful when the
container log collector already forwards the PHP/Apache error stream. Collector
addresses, credentials, and site retention policy do not belong in generated
application source.

## Event and privacy rules

Events are one-line JSON prefixed with `GENAPP_AUDIT` and use schema
`genapp.file_transfer.v1`. Upload events are `upload_succeeded` and
`upload_failed`. Download events are `download_requested` and
`download_denied`. A random transfer ID is placed on the redirected static-file
request so the receiving log system can correlate the application event with
the Apache status and byte count.

For a newly uploaded experimental `lrfile`, the same transfer ID also follows
the private ownership receipt. If SASSIE's designated scientific profile filter
rejects that exact current-submission upload and the receipt-gated cleanup
deletes it, the runtime emits `upload_failed` with outcome `rejected` and
failure `scientific_validation`. The earlier `upload_succeeded` event records
successful byte receipt; the correlated follow-up records that the content was
not accepted for calculation. General run failures and files selected from the
server do not produce this scientific-rejection event.

Allowed details are authenticated username, project, module/input identifier,
safe basename or user-relative path, byte size, outcome/failure category,
source IP, and transfer ID. Never log file contents, request bodies, cookies,
passwords, external-identity assertions or tokens, Login.gov email addresses,
or absolute filesystem paths.

The redirect endpoint accepts only an existing regular file beneath
`results/users/<authenticated-user>/`. It rejects missing sessions, another
user's tree, traversal, unresolved paths, and non-files. Audit failure must not
interrupt ordinary application processing.

The emitter returns success only when the configured local sink accepts the
message. That result does not prove that a downstream collector or SDL received
the event. A failed syslog write produces the content-free local warning
`GENAPP_AUDIT_DELIVERY_FAILURE destination=syslog`; the warning deliberately
does not repeat usernames, paths, filenames, or other event fields. Encoding
and unexpected runtime failures use the same marker with an appropriate
destination value. These signals allow operations staff to detect local
delivery failures without turning logging trouble into an upload failure.

## Operational boundary

The application produces events; the deployment owns collection, encrypted
forwarding, alerting, rotation, local size limits, and retention. Detailed
scientific run logs are not forwarded wholesale. Deployments should forward
security, authentication, transfer, service-lifecycle, warning, and error events
and retain local logs only within their approved time and size limits.

Tests must cover an opted-in application, a non-opted-in control, same-origin
result links, cross-origin links, and server-side user-tree containment.

Acceptance has two separate stages. First, a local format test sends a real
emitter message to a mock collector and verifies the prefix, JSON schema,
required fields, single-line sanitization, and exclusion of sensitive fields.
Second, the deployment must exercise the actual IT-supported forwarding path
with a unique transfer ID and confirm that the corresponding record is visible
in SDL. The transport test must use the same source, protocol, and routing used
in production; a passing format test or a successful local write is not
evidence of SDL receipt. The deployment is not complete until the SDL canary is
observed and correlated by its transfer ID.
