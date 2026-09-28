# PHP compatibility report — 2026-09-23

## Result

The expanded GenApp PHP test set ran 282 checks per interpreter on macOS.

| PHP | Existing runtime contracts | New strict compatibility gates | Overall |
| --- | --- | --- | --- |
| 7.4.33 | Pass | Pass | Pass |
| 8.4.25 | Pass | Fail | Not migration-ready |
| 8.5.10 | Pass | Fail | Not migration-ready |

The PHP 8 failures come from the new checks, which means the expansion is doing
its intended job: it detects compatibility work that the previous suite did not
exercise. The existing authentication, upload, job-event, generated-endpoint,
and file-selection behavior tests did not expose a PHP 8-only behavior failure.

## Findings

GenApp-owned generated PHP has these migration blockers:

- deprecated `${var}` interpolation under PHP 8.4 and 8.5;
- optional parameters before required parameters in `ga_db_lib.php`;
- backtick command execution deprecated by PHP 8.5.

Bundled dependencies are reported separately:

- the Composer bundle loads, but Guzzle Promise produces implicit-nullability
  deprecations on PHP 8.4 and 8.5;
- the bundled MongoDB helper adds non-canonical cast deprecations on PHP 8.5;
- the optional legacy Airavata/Thrift integration already contains deprecated
  and invalid PHP under the PHP 7.4 baseline and needs an explicit replace-or-
  retire decision.

## Evidence and remaining gate

The detailed machine-readable test output and exact loaded-extension lists were
written to `/private/tmp/genapp-php-compatibility.md` during this run. The
repository matrix runner can reproduce that report with explicit PHP paths.

Linux container verification remains pending. Docker Desktop was started and
the local daemon was available, but all three official PHP image pulls stalled
in Docker's credential helper and were interrupted after a bounded wait. macOS
results are development evidence only; the same matrix must pass in pinned Linux
PHP environments before selecting PHP 8.4 or 8.5 for deployment.
