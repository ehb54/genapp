# Feedback job attachments

Applications can opt in to bounded, server-side feedback attachments for files
that belong to a selected job. This contract is intentionally generic: GenApp
does not recognize application module names, scientific file formats, or
application-specific output layouts.

## Declaration

An application declares a submitted input containing its run directory name,
the permitted filename patterns, and the allowed nesting below the module
directory:

```json
"feedbackjobattachmentrunfield" : "run_name",
"feedbackjobattachmentpatterns" : "*.sassie_log,*.sassie_json",
"feedbackjobattachmentmaxdepth" : "1"
```

The selected job's immutable `_args_<uuid>` record supplies the run field. The
authorized job record supplies the project directory and module id. GenApp
therefore searches only `<job directory>/<run_name>/<module id>`; it never
uses a path or pattern submitted with the feedback request.

## Safety and limits

The collector accepts safe single path components only, resolves every root and
candidate with `realpath`, rejects links and paths outside the selected subtree,
and does not invoke a shell. Configured depth is capped at four levels.

GenApp attaches at most 16 files per selected job, no more than 8 MiB per file,
and no more than 16 MiB of additional artifact data per feedback submission.
Candidates older than the selected job's argument record are omitted so a
reused run name does not attach stale files. Missing, unreadable, stale, or
oversized optional files do not prevent feedback delivery; the generated
`attachmentsummary.txt` states why each was omitted.

Artifacts are read after validation and delivered as bounded string attachments
named with the job UUID. This prevents a post-validation path replacement and
keeps names distinct when feedback references multiple jobs.

Applications own the declaration, output naming, and interpretation of the
attached artifacts. GenApp owns the authorization, containment, limits, and
delivery behavior.
