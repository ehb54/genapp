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

For a newly uploaded `lrfile` explicitly rejected by an application's existing
input-file filter, `upload_failed` with outcome `rejected` and failure
`scientific_validation` is emitted before receipt-gated cleanup. A separate
`rejected_upload_cleanup` event reports actual outcome `deleted`, `failed`,
`missing` or `preserved`, using the same transfer ID and existing envelope.
This records rejection even when deletion fails. The earlier accepted-transfer
record retains its existing meaning: successful byte receipt. No expansion of
ordinary accepted-upload logging is required by this cleanup change.
General form/run errors and server-selected files do not authorize deletion.
The exact receipt, callback, concurrency and reconciliation rules belong to
`doc/Rejected-Experimental-Lrfile-Cleanup.md`.

Allowed details are authenticated username, project, module/input identifier,
safe basename or user-relative path, byte size, outcome/failure category,
source IP, and transfer ID. Never log file contents, request bodies, cookies,
passwords, external-identity assertions or tokens, Login.gov email addresses,
or absolute filesystem paths.

The redirect endpoint accepts only an existing regular file beneath
`results/users/<authenticated-user>/`. It rejects missing sessions, another
user's tree, traversal, unresolved paths, and non-files. Audit failure must not
interrupt ordinary accepted-transfer processing. For explicit rejected-upload
cleanup, an enabled rejection-audit failure preserves the file and receipt; an
outcome-audit failure preserves the known result for reconciliation. Disabled
auditing remains compatible but cannot satisfy NIST acceptance.

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

Rejected-upload acceptance must confirm both correlated records and the actual
file outcome. Local emitter success does not prove downstream delivery. Check
receipt/forwarding retention and reconcile pending operations explicitly;
source changes do not repair collector listeners, routing or certificates.

## Background-job error-log destination

The jobrun daemon closes standard streams. When PHP has no configured
`error_log`, jobrun sets it to its existing `/tmp/php_errors` diagnostic log
before detaching; otherwise it preserves the configured destination. An
`audit.destination` of `error_log` therefore requires collection of that actual
CLI sink as well as the web-server sink. The syslog destination is unchanged.
The daemon-startup regression closes real streams and verifies both correlated
records in the selected log; mocked completion callbacks alone cannot verify
this boundary. Local records still do not establish SDL delivery.
