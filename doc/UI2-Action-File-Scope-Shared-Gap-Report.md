# Action File Scope Shared-Gap Report

Status: approved for implementation on 2026-09-08.

## Application symptom

An action in a form with mutually exclusive required file inputs could not run.
The client sent the selected file for the active branch, but the generated
action endpoint attempted to stage every declared file field and rejected the
empty required file from an inactive branch.

Changing the application helper could not solve this because the generated
endpoint rejected the request before invoking that helper. Making every
conditional file optional would weaken ordinary form validation.

## Neutral reproduction

The existing `action_button` fixture now declares two required, non-repeated
file fields. Its scoped action needs only the primary file. The opted-in runtime
case supplies that file, omits the unrelated secondary file, and must reach the
helper. The non-opted-in action remains the compatibility control and must
continue to require both files.

## Generic contract

An action may declare `actionfiledata` as a comma-separated list of file field
ids. The generated endpoint stages and enforces required status only for those
fields. An absent declaration preserves the established behavior of staging
and enforcing every declared file field. Invalid, empty, unknown, or non-file
ids fail closed as application configuration errors.

The contract is application-neutral. It contains no application, module,
output, or scientific identifiers and changes neither action response payloads
nor normal job submission.

## Compatibility and rollback

Only actions that opt in change behavior. Existing applications and actions
remain non-opted-in controls. The implementation is shared by generated HTML5
and UI2 action endpoints; it adds no HTML5 widget or workflow. Rollback consists
of removing the application declaration and reverting the endpoint filter.

## Verification

- Generate the neutral fixture for HTML5 and UI2.
- Check the opted-in and non-opted-in endpoint behavior under PHP.
- Confirm the action metadata is present in generated UI2 module JSON.
- Run the existing UI2 runtime and generation suites.
- Regenerate only the deployed UI2 application and complete the authorized
  browser acceptance cases, including output verification and reattachment.

The repository owner explicitly approved the shared GenApp change and exact
cross-repository manifest in the issue #201 task on 2026-09-08.
