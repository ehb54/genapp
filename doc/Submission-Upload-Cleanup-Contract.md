# Submission Upload Cleanup Contract

This contract governs rollback of newly uploaded files when an application
rejects a submission during input validation. GenApp owns file movement,
ownership records, and deletion. Application drivers only classify the final
failure response.

## Submission ownership

For each successful `move_uploaded_file` operation, the generated handler must:

1. choose a collision-safe destination without overwriting an existing path;
2. record the exact final path in a server-only, per-job manifest;
3. record the canonical project root and the file device, inode, and size; and
4. fail the submission and remove that new file if ownership cannot be
   recorded.

Only files newly moved from the HTTP upload are owned by this manifest.
Existing project files and files chosen through `_selaltval_` are never added.
Repeated and matrix inputs use the same rule for every actual uploaded member.

## Application classification

An application may add the following reserved field to its final stdout JSON
when type conversion or its interface filter rejects submitted input before
scientific execution:

```json
{"_failure_class": "input_validation"}
```

The marker classifies the failure; it does not identify paths and does not
authorize the application driver to delete files. Runtime, dependency,
scientific, cancellation, and output-generation failures must not use this
classification.

## Central cleanup

After reading valid terminal JSON, `jobrun.php` invokes the shared cleanup
helper only when the reserved field exactly equals `input_validation`. The
helper may unlink only a manifest-owned regular file that:

- still resolves inside the recorded canonical project root;
- is not a symbolic link; and
- still has the recorded device, inode, and size.

Missing files are harmless. A path that fails any check is preserved and
reported as refused. Cleanup is non-recursive and idempotent. The manifest is
retained with timestamped cleanup results so operators can audit what was
removed or refused.

Successful jobs, unclassified failures, malformed output, and cancelled jobs
preserve uploaded inputs. Cleanup does not change scientific output contracts,
normal final JSON handling, job-event transport, or completed-job
reattachment.

## Validation

GenApp tests cover generation of the shared helper, collision naming,
ownership recording, exact failure dispatch, preservation of unowned files,
identity mismatch refusal, path containment, symlink refusal, and idempotence.
Application tests cover the shared classification helper and require active
drivers to use it for interface-validation responses.
