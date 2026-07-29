# GenApp Architecture Audit

This is a source-derived working map for GenApp architecture work. It is meant
for maintainers adding generator behavior, new widgets, new runtime features, or
new target support. It complements the user-facing wiki; it does not replace it.

Last audited: 2026-06-20.

## How To Read This File

Confidence labels:

- `confirmed`: checked against local source.
- `inferred`: likely from source structure, but not fully traced.
- `wiki-derived`: from the GitHub wiki, useful context but not enough alone.
- `open`: needs further audit or a focused experiment.

For architecture work, start here after reading `AGENTS.md` and refreshing the
wiki with `tools/refresh_github_wiki.sh`.

## Executive Model

`confirmed`

GenApp is a data-driven generator. An application directory supplies JSON
definitions and module executables; the generator expands language-specific
templates into `output/<language>/`.

The main generator path is:

1. `bin/genapp` or `bin/genapp.pl`
2. `bin/genapp_run.pl`
3. `etc/perl/genapp_util.pl`
4. `etc/perl/ga_layout.pm`
5. `languages/<target>.json`
6. `languages/<target>/...` templates

`bin/genapp` and `bin/genapp.pl` require `GENAPP` to point at the GenApp source
tree. They ensure a usable Perl version and then `exec` `bin/genapp_run.pl`.

## Generator Phases

`confirmed`

`bin/genapp_run.pl` performs these broad phases:

1. Parse flags such as `-d*`, `-sr`, `-gd`, and `-kl`.
2. Require `etc/perl/genapp_util.pl` and `etc/perl/ga_layout.pm`.
3. Run `check_files()`.
4. Iterate over each language listed in `directives.json`.
5. Reload language-specific `directives.json` and `menu.json`.
6. Load `languages/<language>.json`.
7. For each target assembly step, read one or more template inputs.
8. Substitute flattened replacement tokens such as `__moduleid__`,
   `__fields:id__`, and `__menu:modules:id__`.
9. Write generated output under `output/<language>/`.
10. Copy or generate static/runtime files requested by the language definition.
11. Run post-generation commands for assembly steps marked `execute`.

The source currently has substantial global state in `genapp_util.pl`
(`%langs`, `%module_to_file`, `%extra_subs`, `$directives`, `$menu`, `$config`,
`$configbase`, etc.). Treat generator changes as global-state sensitive.

## Application Inputs

`confirmed`

An application directory is expected to provide:

- `directives.json`: global app/generation data, including `languages`.
- `menu.json`: menu hierarchy and menu-to-module references.
- `modules/*.json`: module field definitions.
- `views/*.json`: optional target-neutral view organization hints keyed by
  module id. These are plain JSON files, not module files.
- `bin/`: command-line executables used by module wrappers.
- `add/`: files copied into generated output.
- Optional `<language>/` overrides.

Fallbacks:

- `config.json` and `configbase.json` may be taken from `$GENAPP/modules/` if
  not present in the app directory.
- Referenced module JSON files may be taken from local `modules/` or from
  `$GENAPP/modules/`.

Language-specific override behavior:

- `<language>/directives.json` is appended/merged into base `directives.json`.
  It must not define `languages`.
- `<language>/menu.json` replaces base `menu.json` for that target.
- `<language>/modules/<module>.json` replaces the base module JSON for that
  module.
- `<language>/module_overrides/<module>.json` is a clearer full module
  replacement path and takes precedence over `<language>/modules/<module>.json`
  when present.
- `<language>/views/<module>.json` optionally refines the target-neutral
  `views/<module>.json` for that target.
- `<language>/add/` is copied after base `add/`, so it can overwrite files.

Optional view lookup:

```text
{}
+ views/<module>.json
+ <language>/views/<module>.json
-> __viewjson__
```

View JSON is exposed to templates with `__viewjson__`. Missing view files
produce `{}`. Views are intended to organize presentation only; they should not
redefine field types, repeat dependencies, executables, hook payloads, output
ids, defaults, or backend request shape.

## UI2 Runtime Boundary

`confirmed` plus `inferred`

`ui2` is the GenApp target language. `ui2-react` is a React/shadcn workbench
inside that target, not a separate target language. The target definition lives
in `languages/ui2.json`; the plain JavaScript runtime in
`languages/ui2/add/js/ui2.js` owns module loading, field production, values,
repeat visibility, submission, polling, output rendering, ordered runtime-event
transport, reattachment, and the bridge exposed to React.

React source under `languages/ui2/react/` owns curated workspace composition and
visual presentation. Plotting follows the recovery guardrails in
`doc/Plotting-Architecture.md`: the UI2 runtime keeps the existing Plotly output
path and React owns workspace composition around that bridge. The rejected
`ehb54/zazzie#193` semantic plotting path must not be used as an implementation
guide. NGL and other molecular-structure viewers remain separate viewer
concerns.

Action/precheck consequence: if a module-level action or pre-run check is added
for UI2, implement the behavior in the UI2 core target/runtime first. Let React
receive it through existing field production where possible. Add a bridge method
only when a custom React view needs to invoke the same UI2-owned action without
rendering the standard field producer. Do not create a standalone
`ui2-react` target, move semantics into `views`, or make React own the backend
request/response contract for this feature.

Plotting consequence: do not add GenApp field types or reattachment stores to
support the rejected semantic plotting experiment. Shared driver/helper code is
acceptable when it reduces duplicated web-plot preparation and keeps visual
policy in UI2.

Reattach consequence for future module work: treat live streaming and durable
reattachment as separate responsibilities. Transient WebSocket updates may
power in-run visuals, but UI2 core must still publish or preserve the durable
final outputs that reattachment can replay later. For structure-style viewers,
that means the original/reference structure and any final composite output must
remain available even if live frames were already streamed. React views should
rebuild their submitted-input summaries from declared module fields only and
must not infer durable state from transport/session metadata or from transient
live events.

The current precheck/action intent is additive and separate from hooks:

- a user-visible button or control may run an optional or conditional precheck;
- precheck may validate current values, run a configured executable, update
  fields, return a message, or show a warning/dialog;
- hooks remain automatic field-fill behavior and should not be overloaded for
  this manual action path;
- response contracts should be target-neutral enough for future PyQt, Swift, or
  other target implementations;
- files created by precheck execution should be treated as run data and moved
  into the run-name module folder when a run is created.

## JSON Loading And Traversal

`confirmed`

Core functions in `etc/perl/genapp_util.pl`:

- `get_file_json($file, $append_file)`: reads JSON with `#` comment lines
  stripped, optionally merges an append file, extracts `dependencies` and
  `panels` into `%extra_subs`, calls `layout_expand()`, stores `__layout__`,
  and removes per-field `layout` from the module JSON before normal traversal.
- `get_file_json_lang_specific($file, $language, $replace)`: prefers
  `<language>/module_overrides/<module>.json` for module files when present,
  then `<language>/<file>` when present, either replacing or merging depending
  on `$replace`.
- `get_optional_view_json($module_id, $language)`: reads optional plain JSON
  view files without module/layout side effects and merges target-specific view
  data over target-neutral view data.
- `start_json($json, $ref)`: flattens nested JSON into an iterator of
  replacement maps.
- `next_json($ref, $match)`: advances through flattened maps, optionally until
  a matched key changes.
- `rewind_json($ref)`: resets an iterator.
- `get_lang_json($language)`: loads `$GENAPP/languages/<language>.json`.

The replacement model is string-template based. Tokens look like
`__key__` or nested-path tokens such as `__fields:id__`.

Conditional template fragments use forms such as:

- `__~somekey{...}`: include the body when a replacement key exists and is not
  false.
- `__!somekey{...}`: include the body when a replacement key is absent or false.

Multi-value expansion exists for values containing `~`, especially list-style
template fragments that use placeholders such as `~0`, `~1`.

## Validation And Registration

`confirmed`

`check_files()` in `etc/perl/genapp_util.pl` is the main pre-generation
validator. It:

- Loads required base files.
- Collects target languages from `directives.json`.
- Adds relevant `menu.json` files to checks, including language-specific menus.
- Checks required directive fields such as `title`, `application`, and
  `version`.
- Adds generated special directives such as `generatedon`, `apprevision`,
  `revision`, and `datetimeinseconds`.
- Detects duplicate menu/module ids.
- Builds `%module_to_file` per language.
- Checks module file names against `moduleid`.
- Collects all field `type` values used by modules.
- Validates duplicate field ids and some type-specific rules, such as listbox
  `values`.
- Checks repeater dependency rules and can emit repeater graphs.
- For targets that assemble per-field type templates, checks every used type
  has both `$GENAPP/languages/<language>/types/<type>.input` and
  `$GENAPP/languages/<language>/types/<type>.output`.

Important extension consequence: adding a new module field type requires
input/output templates for every target language listed by the app that uses
per-field type templates. Manifest-oriented targets that do not expand
`__fields:type__` templates can carry module field types without owning a
parallel no-op type-template tree.

## Target Assembly Model

`confirmed`

Each target has a top-level `languages/<target>.json`. Its `assembly` array
describes generated outputs, source templates, and iteration frequency.

Important assembly fields:

- `frequency`: examples include `once`, `menu:id`, `menu:modules:id`,
  `config:modules:id`, and `configbase:modules:id`.
- `output`: generated output path relative to `output/<target>/`.
- `inputs`: template files and their iteration context.
- `prefix`: can prepend a module `prefix` to template file selection.
- `setexecutable`: chmods the output executable.
- `clobber`: allows duplicate outputs.
- `minify`: supports selected minification paths.
- `execute`: can run generated files at generation time or at the end.

`languages/html5.json` is the richest target and assembles:

- CSS files.
- `index.html`.
- menu and module AJAX HTML/PHP.
- system PHP endpoints.
- utility scripts.
- combined GenApp JavaScript.
- vendor JavaScript bundle.
- SCSS/theme artifacts.

`languages/docker.json` generates a Docker build script from header, per-module,
and footer templates.

`languages/nodeapi.json` generates API server/runtime files. Although
`languages/nodeapi/types/` exists, the current nodeapi assembly file does not
appear to iterate those type templates the way `html5` does.

## Layout System

`confirmed`

Layout is generated in Perl and consumed in browser JavaScript.

Perl side:

- `get_file_json()` calls `layout_expand()` from `etc/perl/ga_layout.pm`.
- `layout_expand()` calls `layout_prep()` and builds a layout object.
- `layout_prep()` ensures a `root` panel, panel defaults, repeater panels, and
  control buttons.
- It injects `b_submit`, `b_reset`, and system output fields such as
  `<module>_progress`, `<module>_output_msgs`, and
  `<module>_output_textarea` when needed.
- It strips most field details out of the layout object, keeping fields like
  `id`, `role`, `type`, `layout`, `repeater`, and `repeat`.
- The final layout JSON is substituted into templates via `__layout__`.

Browser side:

- `languages/html5/types/input.header` sets `ga.layout.panel` from
  `__layout__` and `ga.layout.module.json` from `__modulejson__`.
- `languages/html5/js/layout.js` initializes module layout state, maps fields
  by id, builds panel/field groupings, renders HTML, and returns eval snippets.
- Each type template defines entries in `ga.layout.fields[<field-id>]`,
  typically with `.lhtml`, `.dhtml`, and `.eval`.

Extension consequence: a new widget that needs layout behavior should fit the
`ga.layout.fields[id] = { lhtml, dhtml, eval }` contract unless a broader layout
refactor is intentional.

## HTML5 Widget Anatomy

`confirmed`

HTML5 widgets live in:

- `languages/html5/types/<type>.input`
- `languages/html5/types/<type>.output`

An input template usually:

- Creates `ga.layout.fields["__fields:id__"]`.
- Defines label HTML in `.lhtml`.
- Defines control HTML in `.dhtml`.
- Defines initialization/event JavaScript in `.eval`.
- Registers required validation with `ga.value.registerid(...)` when needed.
- Restores last values with `ga.value.setLastValue(...)`.
- Handles repeaters with `ga.layout.slayout(...)`, `ga.repeat.repeat(...)`, and
  `ga.repeat.repeatOn(...)` when `fields:repeat` is present.

An output template usually:

- Defines an output DOM element with an id matching the output field id.
- Sets a meaningful `type` attribute for `ga.data.update`.
- Registers last-value restoration when appropriate.

Runtime helpers used by widgets include:

- `languages/html5/js/layout.js`: layout rendering and field container assembly.
- `languages/html5/js/value.js`: value registration, last value storage,
  reset/default behavior, plot/viewer settings.
- `languages/html5/js/valid.js`: submit-time validation.
- `languages/html5/js/data.js`: output JSON application to DOM widgets.
- `languages/html5/js/repeat.js` and `repeats.js`: repeater behavior.
- `languages/html5/js/altfile.js`: alternate file/source interactions.
- `languages/html5/js/calc.js`: calculated fields.
- `languages/html5/js/pull.js`: pull-populated fields.

## Adding A New HTML5 Widget Type

`confirmed` plus `inferred`

Minimum route of attack:

1. Choose the field type name and decide whether it supports input, output, or
   both.
2. Add `languages/html5/types/<type>.input`.
3. Add `languages/html5/types/<type>.output`.
4. If apps may generate other template-expanded targets, add stubs or real
   templates under those targets' `types/` directories.
5. For input widgets, follow the `ga.layout.fields[id].lhtml/dhtml/eval`
   pattern.
6. For required input validation, register with `ga.value.registerid()` and add
   a corresponding branch in `ga.valid.checksubmit()` if the required type is
   not one of the currently supported values.
7. If the widget uses custom browser behavior, put reusable code in
   `languages/html5/js/*.js` and add that file to the `js/ga.js` assembly list
   in `languages/html5.json`.
8. If the widget displays output JSON in a new way, add a `type` value in the
   output template and add handling in `ga.data.update()`.
9. If the widget needs persisted last-value behavior, update or reuse
   `ga.value.setLastValue()`, `ga.value.saveLastValue()`, and reset paths.
10. If the widget changes request serialization, audit `languages/html5/base.php`
    and form submission code generated from `input.footer`.
11. Create or update a small fixture application that uses the widget.
12. Run `GENAPP=<repo> bin/genapp_check.pl` from the fixture app directory.
13. Run `GENAPP=<repo> bin/genapp` from the fixture app directory and inspect
    generated `output/html5` artifacts.
14. For browser-visible widgets, run the generated app and verify layout,
    submission, result rendering, repeaters, and reattach/last-value behavior.

## Browser Runtime Contract

`confirmed`

HTML5 module pages generated from `types/input.header` and `types/input.footer`
follow this broad runtime path:

1. Initialize `ga.layout` for the module.
2. Build input/output HTML from type templates.
3. Attach widget eval code.
4. On submit, clear outputs, validate required inputs, resolve resource
   selection, and submit to `ajax/<menu>/<module>.php`.
5. Poll or receive messages until the job completes.
6. Apply returned JSON through `ga.data.update(module, data, ...)`.

`ga.valid.checksubmit()` currently knows required checks for float, integer,
text, file, lrfile, rfile, and rpath-like paths. New required semantics should
be added deliberately, not hidden inside only the widget template.

`ga.value.types[module][id]` is the registry used by validation and some value
handling. Input templates should register fields consistently when the field is
part of submit validation.

## HTML5 Backend Job Contract

`confirmed`

Generated module PHP is based largely on `languages/html5/base.php`.

Broad flow:

1. Gather request values and uploaded files.
2. Validate/trim required file inputs using embedded `__modulejson__`.
3. Build a run directory/project directory.
4. Transform repeater-style request keys into nested request structures.
5. Optionally inject `_json` when `sendmodulejson` is enabled.
6. Encode request data as JSON.
7. Pass JSON to the executable directly or through an `_args_<uuid>` file for
   large inputs.
8. Write `_args_<uuid>`, `_cmds_<uuid>`, `_stderr_<uuid>`, and eventually
   `_stdout_<uuid>` logs.
9. Start `util/jobrun.php` asynchronously for normal job-controlled execution.

`languages/html5/util/jobrun.php`:

- Marks jobs running and finished.
- Executes the stored command.
- Captures stdout, capped through `head -c50000000`.
- Writes `_stdout_<uuid>`.
- Decodes output JSON for some flags such as `_disable_notify`.
- Sends messaging updates through ZMQ/UDP paths.

Extension consequence: module executables must still return JSON on stdout.
New widgets that need complex values should make sure those values survive
HTML form submission, PHP request handling, JSON encoding, executable input,
executable output, and `ga.data.update()`.

## New Usage Or Feature Work

`inferred`

When adding a new usage pattern, classify it before editing:

- Generator-only feature: changes how templates are selected or expanded.
  Likely files: `bin/genapp_run.pl`, `etc/perl/genapp_util.pl`,
  `languages/<target>.json`.
- Schema feature: adds new keys to `directives.json`, `menu.json`, or module
  JSON. Likely files: docs/wiki, `genapp_util.pl` validation, templates that
  consume replacement tokens.
- HTML5 widget feature: new field type or behavior. Likely files:
  `languages/html5/types/`, `languages/html5/js/`, `languages/html5.json`,
  possibly `base.php`.
- Runtime/job feature: changes submission, resources, messaging, logs, or
  results. Likely files: `languages/html5/base.php`,
  `languages/html5/util/jobrun.php`, `languages/html5/js/data.js`,
  system modules under `modules/`.
- Target feature: adds or changes a target language. Likely files:
  `languages/<target>.json`, `languages/<target>/`, validation expectations,
  and possibly installer/runtime docs.

Prefer vertical slices: implement the smallest fixture that exercises the new
behavior end-to-end through generation and runtime before generalizing.

## Testing And Verification

`confirmed` plus `open`

Available local checks:

- `bin/check_json.pl <files>`: parses GenApp JSON with GenApp's comment-stripping
  loader.
- `bin/genapp_check.pl`: runs `check_files()` for the current app directory.
- `bin/genapp`: performs generation for the current app directory.
- `etc/test/test.pl`: tests JSON flattening/replacement behavior against
  fixtures in `etc/test/input` and `etc/test/output.ref`.
- `bin/genapp_run.pl -sr`: emits repeater dependency information.
- `bin/genapp_run.pl -gd`: emits Graphviz for menus/repeaters, but currently
  has caveats with multiple languages and language-specific files.
- `bin/genapp_run.pl -kl`: keeps layout saves in generated output.

Open testing gap: this repo does not currently expose an obvious comprehensive
test harness for generated HTML5 runtime behavior. For widget work, plan on a
small fixture app plus browser/runtime verification.

## Known Architectural Risks

`confirmed` plus `inferred`

- Heavy global state in Perl generator code makes isolated changes difficult.
- Replacement is string-template based, so quoting and JSON embedding are
  fragile, especially around `__modulejson__`, `__layout__`, and HTML/JS text.
- `get_file_json()` has side effects beyond parsing: layout expansion,
  extraction of special substitutions, and layout removal from fields.
- All used field types are checked against all app target languages that
  assemble per-field type templates.
- Some code still calls `svn info` for revision labels; this is metadata only
  and should not revive SVN as a source of truth.
- `base.php` builds shell command strings; feature work touching request values,
  executable paths, or resources should be reviewed with command-injection and
  quoting risk in mind.
- Browser runtime code mixes generated snippets, global `ga.*` state, jQuery,
  eval strings, and DOM ids derived from module/field ids.
- Job reattachment and saved values depend on stable module/field ids and
  output field types.

## Open Questions For Further Audit

`open`

- Which target languages are actively maintained versus historical?
- What is the preferred fixture app for generator/runtime regression tests?
- Is scanning `languages/<target>.json` for `__fields:type__` sufficient as the
  long-term marker for targets that need per-field type-template validation?
- Which runtime paths are still used: Airavata, Abaco, OpenStack/oscluster,
  Docker, local, and nodeapi?
- What is the intended architecture for modernizing widgets: continue with
  template snippets or introduce a cleaner registry/component layer?
- How should generated PHP command construction be hardened without breaking
  existing deployed applications?
