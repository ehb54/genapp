# Rejected lrfile cleanup

This is an application-neutral ownership boundary for browser `lrfile` uploads.
It uses the application's existing input-file filter decision and does not
classify scientific errors, parse error text, or change validation rules.
SASSIE-web participation is owned by
`../genapp_zazzie/docs/rejected_experimental_lrfile_contract.md`.

## Submission and selection

Before publishing uploaded bytes or saving a request, a generated LR-input
handler claims its receipt identity exclusively. A duplicate claim or existing
saved input fails without replacing bytes, request or receipt. Actions use a
fresh server-generated private identity. After a successful move, the receipt
records declared input field, original zero-based row, canonical path,
filesystem identity and transfer ID. Only browser uploads are receipted;
server selections remain outside cleanup. Bookkeeping failure stops dispatch
and preserves uploaded files. It is not a file rejection.

Final `_sassie_rejected_lrfiles` contains only `{field, index}` entries.
Validate the entire marker before mutation; null, malformed, mixed-malformed
and path-bearing markers authorize no deletion. Deduplicate coordinates and
intersect them with the submission's trusted receipt. Related-file groups can
mark multiple members without selecting a unique culprit. Unrelated siblings
and server-selected members remain untouched. A valid marker is handled even
when a legacy cancellation flag or action nonzero exit is also present.
Cancellation, exit status, invalid JSON and unrelated parameter errors alone
never authorize deletion. The asynchronous `started` acknowledgment retains
the receipt until final handling.

## Identity and concurrency

Receipts and lock files reuse the existing owner-only temporary directory
`genapp-rejected-lrfiles-<effective-uid>` outside user projects. v1 receipts
remain readable; optional processing/context fields retain pending evidence.
There is no new configuration root, staging scheme, filename rule or daemon.

Processing takes a per-receipt lock first. Upload publication/identity capture
and cleanup's final identity check/unlink take the same user-storage lock as
ordinary module submissions, action uploads, uploader and File Manager
mutations (including rollback moves). These locks must resolve to the same
canonical user tree and effective owner across web and jobrun processes.
Acquisition is bounded to two seconds; failure never permits an unlocked
mutation. Release storage and receipt locks before scientific/action execution.
Audit callbacks run without the storage lock while receipt exclusion remains.
PHP closes open handles on early exits/errors; normal dispatch explicitly
releases them. Persistent lock files must not be unlinked while processes run.
Read-only File Manager listings do not take the mutation lock.

Only a regular non-link file directly inside the expected directory whose
device, inode, size, change time and modification time still match may be
unlinked. A missing/replaced/moved/linked/out-of-root file is not deleted.
The lock protects against cooperating web writers; it does not grant control
over arbitrary privileged filesystem writers.

## Audit and failure evidence

Jobrun and action call sites supply trusted authenticated context and two
callbacks using the unchanged `genapp.file_transfer.v1` envelope:

1. `upload_failed`, outcome `rejected`, failure `scientific_validation`, before
   unlink for every selected owned upload.
2. `rejected_upload_cleanup`, with actual outcome `deleted`, `failed`, `missing`
   or `preserved`, and a bounded failure reason, after the cleanup attempt.

Both records reuse the receipt's transfer ID and contain safe basename/byte
count, not absolute paths or contents. Older receipts without an ID receive a
stable per-receipt/member ID before processing. A non-success cleanup still
records the rejection independently. Local rejection-audit failure preserves
the file; unlink/storage-lock failure records failure and retains evidence;
outcome-audit failure retains the known result after deletion.

Receipt creation refuses duplicates; processing under the receipt lock may
update its own state. Reprocessing a known outcome retries unfinished reporting
without a second unlink. An interrupted unlink intent with no recorded result
stays uncertain; an absent pathname is not proof of successful deletion.
Non-success/uncertain outcomes remain for explicit operator reconciliation.
There is no automatic recovery worker or exactly-once delivery claim. A later
malformed/no-marker response cannot discard pending rejection evidence.
Completed non-rejection receipts and fully reported successful cleanup receipts
are retired. A pending cleanup reports a content-free operational diagnostic
and an actionable final error. Audit-disabled applications preserve ordinary
cleanup compatibility; they cannot pass NIST audit acceptance.

## Acceptance and module scope

The shared hook does not make every module participate automatically. Drivers
must explicitly forward the applicable existing file/group filter result.
SASSIE-web's Data Interpolation pilot and existing compact-profile fields are
qualified separately; the remaining modules/actions need their own manifests
and valid-file/parameter-preservation controls. Scientific calculations,
module output schemas, plot payloads and browser presentation are unchanged.

Run the receipt/audit, mixed-selection, generated-PHP and multipart/race tests.
No expected-failure labels remain for the shared/pilot requirements. Local
source tests are not deployed acceptance: verify supported Linux/PHP behavior,
installed SASSIE, all installed writer/helper hashes, private receipt retention
and both correlated events through the real NIST SDL route. See
`doc/File-Transfer-Audit-Contract.md` and the application delivery guide.
