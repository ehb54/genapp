# GenApp Test Audit

Last audited: 2026-06-20.

This is a source-and-wiki audit of test assets available for GenApp
development. The GitHub wiki was refreshed with `tools/refresh_github_wiki.sh`
before this audit; the local checkout was already current.

## Summary

GenApp has useful validation and smoke-test entry points, but it does not
currently expose an obvious comprehensive CI-style harness for generated HTML5
runtime behavior.

The strongest local assets are:

- `bin/check_json.pl <files>` for parsing GenApp JSON with the same loader used
  by the generator.
- `bin/genapp_check.pl` for validating a complete application directory.
- `bin/genapp` for generator smoke tests from an application directory.
- `etc/test/test.pl` for JSON flattening and replacement regression tests.
- `bin/ga_layout.pl`, `bin/genapp -kl`, and `tmp/layout/*.js` for layout-focused
  inspection.

The most important gap is a modern, checked-in, complete fixture application
that can be used for repeatable generator and browser/runtime tests.

## Checks Available Today

### JSON Parser Check

`bin/check_json.pl <files>` loads files through GenApp's JSON path, including
comment stripping and layout-side effects.

Verified during this audit:

```sh
GENAPP=/Users/curtisj/git_working_copies/genapp \
  bin/check_json.pl \
  etc/test/input/test1.json \
  etc/test/input/test2.json \
  etc/test/input/test3.json \
  etc/test/input/test4.json \
  etc/test/input/test5.json
```

Result: all five fixture JSON files parsed successfully.

Use this after JSON edits and before running broader app-level generation.

### Application Validator

`bin/genapp_check.pl` calls `check_files()` in `etc/perl/genapp_util.pl` from the
current application directory.

It checks, among other things:

- Required files such as `directives.json`, plus fallback config files.
- Target languages listed in `directives.json`.
- Base and language-specific `menu.json` files.
- Module file resolution from local `modules/` or `$GENAPP/modules/`.
- Duplicate menu and module ids.
- Module file names versus `moduleid`.
- Field type collection and required target type templates.
- Duplicate field ids.
- Some type-specific rules, such as listbox values.
- Repeater dependencies and repeater depth.

Use this from a complete fixture or application directory:

```sh
GENAPP=/Users/curtisj/git_working_copies/genapp \
  /Users/curtisj/git_working_copies/genapp/bin/genapp_check.pl
```

### Generator Smoke Test

`bin/genapp` dispatches to `bin/genapp_run.pl` after checking `GENAPP` and Perl
version. From a complete application directory, it performs the real generation
path into `output/<language>/`.

Useful flags in `bin/genapp_run.pl`:

- `-sr`: print detailed repeater information and stop.
- `-gd`: generate Graphviz `.dot` files for menus and repeaters, then stop.
- `-kl`: keep processed layouts in `output/<language>/layout`.

These are especially useful for layout and repeater work because they expose
intermediate generator state.

## Regression Fixtures

### `etc/test/test.pl`

`etc/test/test.pl` is a compact first-party regression harness for the JSON
flattening/replacement iterator in `etc/perl/genapp_util.pl`.

It:

1. Reads every `etc/test/input/*.json` fixture.
2. Runs `get_file_json()`, `start_json()`, `next_json()`, and `rewind_json()`.
3. Writes normalized replacement maps under `etc/test/output/`.
4. Compares each output file against `etc/test/output.ref/`.

Attempted command:

```sh
GENAPP=/Users/curtisj/git_working_copies/genapp ./test.pl
```

Run from:

```sh
/Users/curtisj/git_working_copies/genapp/etc/test
```

Current result: it does not compile under system Perl 5.34.1 because line 9 uses
the old `each $hashref` form:

```perl
while ( my ( $k, $v ) = each $rplc )
```

Modern Perl requires dereferencing the hash reference explicitly:

```perl
while ( my ( $k, $v ) = each %$rplc )
```

This test is not a passing baseline yet, but it is a good candidate to revive
first because it is small, fast, and directly covers fragile generator behavior.

## Layout Test Assets

Layout has additional historical-but-useful hooks:

- `bin/ga_layout.pl`: command-line test program for fully populating layout
  fields from a module JSON file.
- `bin/genapp -kl`: preserves processed layouts in generated output.
- `tmp/layout/layout2html.js`: converts processed layout JSON to HTML.
- `tmp/layout/layouttest.js`: extracts `ga.layout` lines from generated module
  HTML and renders layout-oriented HTML.

The wiki archive page `Archive-Trac-docs-layout.md` documents these workflows:

```sh
genapp -kl
ga_layout.pl modules/module.json > moduleprocessed.json
node genapp/tmp/layout/layout2html.js moduleprocessed.json > module.html
node genapp/tmp/layout/layouttest.js output/html5/ajax/menu/module.html > module.html
```

Treat those wiki instructions as historical until each path is tested in the
current checkout, but the local files still exist and are worth using for layout
work.

## Wiki Evidence

Current or useful documentation found during the audit:

- `doc/GenApp-Architecture-Audit.md` lists available checks and identifies the
  missing comprehensive HTML5 runtime harness.
- `Setup-Local-Development.md` points to a `genapptest` application instance,
  but that page is imported from Trac and still uses stale SVN instructions.
- `Reference-Menu-JSON.md` points to `genapptest/menu.json` examples.
- `Reference-Module-JSON.md` points to many `genapptest/modules` examples and
  lists field-type behavior.
- `Archive-Trac-docs-layout.md` captures the historical layout-test workflow.

## Local Fixture Status

The repository has `projects/test1/menu.json`, but it is only a partial menu
fixture. It has no local `directives.json` or `modules/` tree, so it is not a
complete application smoke-test fixture.

No `.github` workflow directory was present during this audit.

## Recommended Next Steps

1. Repair `etc/test/test.pl` for modern Perl and confirm that it passes against
   `etc/test/output.ref`.
2. Add a small complete fixture application under a clear test path, with
   `directives.json`, `menu.json`, `modules/`, `bin/`, and minimal `add/`
   content.
3. Use that fixture to exercise:
   - `bin/check_json.pl`
   - `bin/genapp_check.pl`
   - `bin/genapp`
   - `bin/genapp -kl`
   - `bin/genapp_run.pl -sr`
4. For HTML5-visible work, add browser/runtime verification around the generated
   output rather than relying only on generated files.

