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

Allowed details are authenticated username, project, module/input identifier,
safe basename or user-relative path, byte size, outcome/failure category,
source IP, and transfer ID. Never log file contents, request bodies, cookies,
passwords, external-identity assertions or tokens, Login.gov email addresses,
or absolute filesystem paths.

The redirect endpoint accepts only an existing regular file beneath
`results/users/<authenticated-user>/`. It rejects missing sessions, another
user's tree, traversal, unresolved paths, and non-files. Audit failure must not
interrupt ordinary application processing.

## Operational boundary

The application produces events; the deployment owns collection, encrypted
forwarding, alerting, rotation, local size limits, and retention. Detailed
scientific run logs are not forwarded wholesale. Deployments should forward
security, authentication, transfer, service-lifecycle, warning, and error events
and retain local logs only within their approved time and size limits.

Tests must cover an opted-in application, a non-opted-in control, same-origin
result links, cross-origin links, and server-side user-tree containment.
