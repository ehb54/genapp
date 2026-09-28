# PHP compatibility testing

GenApp's maintained PHP compatibility check uses PHP 7.4 as the legacy behavior
baseline and PHP 8.4 and 8.5 as migration targets. The test files obtain their
interpreter from the `PHP` environment variable. If `PHP` names a missing or
non-executable file, the test fails instead of silently skipping PHP coverage.

Run the local matrix by supplying explicit interpreter paths:

```sh
tools/run_php_compatibility.pl \
  --php /opt/homebrew/opt/php@7.4/bin/php \
  --php /opt/homebrew/opt/php@8.4/bin/php \
  --php /opt/homebrew/opt/php/bin/php \
  --report /tmp/genapp-php-compatibility.md
```

The normal matrix covers GenApp-owned runtime contracts, authentication,
uploads, job events, generated endpoint behavior, and strict syntax checks for
the complete first-party PHP output of the representative HTML5 fixture.

The checked-in Composer and Airavata dependency trees are a separate boundary.
Their autoload entry points are exercised in the normal matrix. Composer
compatibility is a hard migration gate. The optional legacy Airavata integration
already contains deprecated and invalid PHP under the PHP 7.4 baseline, so its
checks are recorded as explicit TODO debt pending a decision to replace or
retire it. Use `--include-vendor` for the longer syntax pass over every bundled
dependency file. Compatibility diagnostics from these trees must not be
presented as GenApp-owned PHP failures.

For release evidence, run the same command in pinned Linux PHP environments.
macOS results are useful development evidence, but Linux container results are
authoritative for the deployed runtime. Record the generated report with the
exact PHP revisions and loaded extensions.
