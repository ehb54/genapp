# Submission Upload Cleanup Contract

This contract governs rollback of newly uploaded files when an application
rejects a submission during input validation. GenApp owns file movement,
ownership records, and deletion. Application drivers only classify the final
failure response.

## Submission ownership

The generated handler accepts each browser upload as one transaction. It must:

1. move the HTTP upload into a private staging directory on the destination
   filesystem;
2. atomically publish the staged file with a no-overwrite filesystem operation,
   selecting a suffixed name when the requested path already exists;
3. record the exact final path in a server-only, per-job manifest;
4. record the canonical project root and the file device, inode, and size; and
5. fail the submission and remove only that same file identity if ownership cannot be
   recorded.

Checking whether a destination exists and then calling an operation that can
overwrite it is prohibited. Normal concurrent submissions requesting the same
name must both survive under distinct names. Rollback must compare device,
inode, and size before unlinking so that a replacement path is preserved.

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

GenApp tests cover generation of the shared helper, concurrent atomic collision
naming without overwrite, ownership recording, exact failure dispatch,
preservation of unowned files, identity mismatch refusal, path containment,
symlink refusal, and idempotence.
Application tests cover the shared classification helper and require active
drivers to use it for interface-validation responses.
