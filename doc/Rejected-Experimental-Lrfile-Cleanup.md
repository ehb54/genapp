# Rejected experimental lrfile cleanup

This is an application-neutral ownership boundary for local `lrfile` uploads.
It does not classify scientific or validation failures.

Generated module handlers record a private receipt only after
`move_uploaded_file` succeeds for a field declared as `lrfile` in that module's
JSON. The owner-only receipt is kept in a process-private temporary directory
outside the user project tree and contains the declared field id, zero-based
repeat index, canonical path, and filesystem identity. It is discarded when
the completed output is processed. Server-selected and previously stored files
do not pass through `move_uploaded_file` and are never receipted.

A completed driver may return `_sassie_rejected_lrfiles`, whose entries contain
only a field id and zero-based index. GenApp treats these as untrusted
coordinates, intersects them with the receipt for the same submission, and
deletes only a regular non-link file still located directly in the expected
project directory with the same device, inode, size, change time, and modified
time. Missing, replaced, linked, moved, malformed, unmatched, or out-of-root
files are preserved. Driver output never supplies a deletion path.

Only errors from SASSIE's compact-consumer SAS profile file filter may cause a
SASSIE-web driver to emit this marker. General input errors, runtime failures,
cancellation, and success do not. The scientific rules and field participation
are owned by SASSIE and SASSIE-web; see
`../zazzie/docs/source/sas_interpolation_policy.rst` and
`../genapp_zazzie/docs/rejected_experimental_lrfile_contract.md`.
