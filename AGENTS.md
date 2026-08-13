# Agent Guardrails

Guidance for developers and automated agents working on GenApp generator and
runtime code. These rules are maintained on the `php7designer` branch; they do
not imply authority over other branches or upstream development.

If a task concerns SASSIE, Zazzie, the Zazzie3 deployment, or SASSIE-driven use
of GenApp, read the branch-specific SASSIE-web addendum at the end of this file
before planning, recommending architecture, or changing code.

## Authority And Communication

- Use plain language first. State what changed, what was verified, remaining
  uncertainty, and the next concrete steps.
- For multi-step work, include an approximate count of remaining steps, even
  when the immediate request is complete.
- When the requesting user is `madscatt`, obtain explicit permission before
  creating or switching to a Git branch.
- Preserve unrelated dirty files and another contributor's work. Do not stage,
  commit, deploy, or rewrite shared history unless requested or included in the
  agreed workflow.
- ROA/rao means inspect and report without changing local or remote state.
- ROAPTG/roaptg means read-only audit/adapt planning for Terra guardrails:
  inspect applicable repositories and instructions, identify adaptations, and
  report a concrete plan without changing files or remote state.
- gacp means stage, commit, and push only intended changes.
- Do not use the phrase "smoke test" in communications, chat, Markdown, or documentation.

### Generated HTML5 artifact policy

`languages/html5/add/js/ga.min.js` is a tracked artifact of the GenApp HTML5
assembly. During GenApp generation, `gacp`, `gacpu`, or deployment work, do not
stop or request confirmation solely because this file has a diff. Record whether
it was already dirty before generation: preserve and do not stage a pre-existing
diff unless it is in scope. If a clean file is regenerated from intended HTML5
source changes, include it in that same GenApp commit. If generation creates
artifact-only drift unrelated to the intended commit, restore it automatically.
Do not add it to `.gitignore` or mark it assume-unchanged.

## UI2 Test Account Access

- The live Zazzie3/UI2 test accounts are `codex` and `codex2`. Apply the same
  usage patterns and rules to both accounts.
- Treat use of either test account as task-scoped privileged access, even when
  Chrome already has an authenticated session or saved credential. Before
  using an authenticated session, logging in, or submitting work as either
  account, obtain explicit permission from the requesting user for the current
  task and account. Permission may cover reauthentication after a logout during
  that task, but it never carries to another task or the other account.
- Keep both test accounts non-admin by default. Permission to use a normal
  account does not authorize administrator-only work or use while that account
  is temporarily elevated.
- Keep the password in the user's browser password manager or another approved
  credential channel. Never ask the user to paste it into chat; never store it
  in a repository, environment file, note, command, or log. During authorized
  browser use, do not read password-field values or take broad DOM snapshots
  while an autofilled password field is present.
- Before administrator testing, stop and obtain separate explicit permission
  that names the administrative purpose and scope, plus confirmation that the
  user has temporarily elevated the specific test account. Do not elevate
  either account yourself unless separately directed. Perform only the approved
  administrator checks. When finished, log out, ask the user to remove the
  elevation, and do not use that account again until the user confirms it is
  non-admin; when practical, verify that administrator controls are no longer
  exposed.
- At the end of authorized browser work, log out unless the user asks to keep
  the authenticated tab open. In either case, require fresh permission in a
  later task.

## Documentation Source Of Truth

The GitHub wiki is the current source of truth for GenApp documentation. Prefer
the local sibling checkout at `../genapp.wiki` for efficient reads.

- Refresh it with `tools/refresh_github_wiki.sh` before relying on
  freshness-sensitive documentation.
- Current entry points include `Home.md`, `Start-Here.md`,
  `Developer-Guide.md`, `Reference.md`, `Wrap-an-Application.md`, and
  `Tutorial-Demo-App.md`.
- Many promoted pages were mechanically imported from Trac. Use them for
  concepts and schema details, but treat old paths, SVN URLs, hosts, OS versions,
  and deployment commands as historical until verified.
- Checked-in `doc/` policies govern repository architecture and support
  boundaries when they explicitly identify themselves as normative.
- Before planning a shared change, search the affected target and application
  for current `*POLICY*`, `*CONTRACT*`, README, schema, and maintained test
  documentation. Do not treat an old design plan or audit as adopted policy.

## GenApp Working Model

GenApp generates science-gateway and application interfaces from application
JSON plus executable wrappers. For generator/runtime architecture, new widgets,
new usage patterns, target behavior, or substantial runtime changes, read
`doc/GenApp-Architecture-Audit.md`. Keep detailed call graphs and open questions
there rather than expanding this guardrail file.

Application layout:

- `directives.json`: global generation and application directives.
- `menu.json`: menu hierarchy, module grouping, startup/autorun behavior, and
  optional restrictions.
- `modules/*.json`: module inputs, outputs, resources, submit policy, help,
  notification, and related behavior.
- `bin/`: executable wrappers or programs invoked by modules.
- `add/`: optional static files copied into generated output.
- `<language>/`: target-specific overrides. Target `directives.json` augments or
  replaces settings, `menu.json` replaces the base menu, matching module JSON
  replaces the base module, and target `add/` content overwrites base copies.
- `output/<language>/`: generated application output.

Executable wrappers must write valid JSON to stdout. Put diagnostics on stderr
or in files unless the declared application contract explicitly includes them
in JSON output.

## Repository Map

This repository is the GenApp generator/runtime source, not an application
instance and not the live wiki.

- `bin/`: entry points including `genapp`, `genapp.pl`, `genapp_run.pl`,
  `genapp_check.pl`, and `check_json.pl`.
- `languages/`: target definitions and generation templates.
- `modules/`: built-in and system module definitions.
- `etc/`: Perl utilities, configuration samples, tests, templates, and support
  files.
- `sbin/`: installer and application-management scripts.
- `dockerfiles/`: container build material.
- `tools/`: maintenance helpers, including wiki refresh tooling.
- `projects/`, `tmp/`, and `supplementary/`: examples, experiments, migrated
  assets, or support material; inspect freshness before relying on them.

The `genapp` and `genapp.pl` entry points require `GENAPP` to identify this
repository and dispatch to `bin/genapp_run.pl`. The runner validates the
application directory, reads target definitions, and assembles generated files
from templates and overrides.

## UI2 Core Extension Gate

Read `doc/UI2-Core-Extension-Policy.md` before planning or changing UI2 runtime,
React workbench core, generated UI2 core assets, or their tests for an
application module.

- Begin at the application view, schema, wrapper, or application-owned helper.
- Change GenApp core only after a neutral shared-gap reproduction, a generic
  schema/contract, opted-in and non-opted-in tests, and explicit user approval.
- Core behavior must not depend on application module ids, output ids, or
  application-specific scientific meaning.
- Use documented generic presentation and capability tokens. Keep application
  role mapping and display defaults in application-owned metadata.
- Do not add permanent exception lists, per-application core branches, or
  migration-status registries to bypass this gate.
- A screenshot from one application is not proof of a shared core defect.

## Legacy Target Prime Directive

The generated `html5` application is production legacy behavior. New target
work such as `ui2` must not silently change HTML5 output, deployment directives,
system modules, login/splash behavior, themes, Job Manager columns, or generated
runtime assets.

The authoritative lifecycle and compatibility decision is
`doc/UI2-Support-Policy.md`: UI2 with React workbenches is the primary web
surface, native UI2 is the fallback/reference renderer, and HTML5 is in legacy
maintenance mode. Preserving HTML5 does not require new UI2 widgets, workflows,
layouts, or presentation features to be backported.

- Prefer target-filtered generation such as `genapp --language ui2` during UI2
  work.
- Regenerate HTML5 only when the task explicitly calls for legacy change or
  verification.
- Treat ignored runtime files such as application `directives.json` as deployed
  state. Refresh them only from the tracked source intended for that app.
- Keep tracked deployment directives and their guardrail checks aligned.
- Shared UI2 changes require tests proving target filtering and legacy
  generation remain intact.
- Keep transport, fields, submission, polling, output rendering, and reattachment
  in generic UI2 core/runtime. React workbenches consume those facilities through
  the existing bridge; `ui2-react` is not a separate target language.

## Cross-Repository Work

Before planning, editing, testing, deploying, or drawing runtime conclusions
about another repository, read and follow its applicable `AGENTS.md`. The target
repository controls its interpreter, branch, deployment, testing, ownership,
and scientific rules. Do not assume GenApp conventions control an application
repository or scientific backend.

For requests to make application B behave like application A, inspect both
current implementations, maintained tests and policies, and recent relevant
commits before presenting a plan. Report which generic GenApp contracts are
reused and demonstrate any proposed shared-core gap.

## GitHub Workflow

For this repository, do not use the Codex GitHub connector unless the user
explicitly requests it. Use:

- local `git` for status, branches, history, and diffs;
- authenticated `gh` CLI for GitHub issues, pull requests, comments, labels,
  reviews, and API operations.

Do not probe the connector and then fall back to `gh`. Treat the local checkout
plus `gh` as the normal GitHub workflow for this branch.

## Common Workflows

When changing GenApp itself:

1. Read the relevant current wiki page and corresponding source or template.
2. Prefer existing generator patterns in `bin/`, `etc/perl/`, and `languages/`.
3. Prefer Perl for repository maintenance code, tests, and harnesses when it
   fits existing architecture. Use another language when the target runtime or
   established local tooling clearly requires it.
4. Use specific validation language such as `basic validation`, `generation
   check`, or `workflow check`; do not use the prohibited informal two-word
   validation phrase in documentation, comments, issues, commits, or user-facing
   summaries.
5. Keep generated-output changes separate from generator/template changes unless
   the task requires generated artifacts.
6. Treat `languages/html5/add/js/ga.min.js` as generated from the HTML5 assembly;
   generator runs may replace it.
7. Validate JSON with `bin/check_json.pl` where applicable.
8. Validate application directories with `bin/genapp_check.pl` or the normal
   `genapp` workflow when an application fixture is available.
9. Put new automated tests under the Perl-native `t/` tree unless a documented
   target-specific reason requires another harness.
10. For JavaScript helpers, prefer a minimal repository-local Node LTS setup and
    drive it from the Perl harness unless the coverage need requires more.
11. Treat Linux CI or a Linux container as authoritative for JavaScript runtime
    results. Mac checks are useful local evidence, not production authority.

When wrapping or debugging an application:

- Confirm the application base contains `directives.json`, `menu.json`, and
  `modules/`.
- Confirm directives identify the expected target languages and application.
- Confirm every active menu module has a matching module JSON after target
  overrides.
- Confirm module executables exist, have required permissions, and emit valid
  JSON stdout.
- Use `safefile` for text fields representing user paths. Do not weaken path
  validation or allow traversal outside the job tree.

## Runtime And Jobs

Before planning or changing UI2 job-event envelopes, capability negotiation,
bounded journals, replay behavior, or runtime delivery, read
`doc/UI2-Job-Event-Protocol.md`. Application drivers may define target-neutral
scientific topics, but a bounded event journal is delivery/display state, not
authoritative completed output.

For HTML/PHP-style generated applications, `appconfig.json` controls mail, host
identity, messaging ports, compute resources, restricted groups, submit policy,
job limits, submit blocks, and MOTD.

- Treat `appconfig.json` as environment-sensitive. Do not invent mail, OAuth,
  host, port, credential, or resource settings.
- Module `resource` and `submitpolicy` may override global defaults.
- Job limits apply only to modules defining `jobweight`.
- Preserve input/output ids where possible; schema changes can break completed
  job reattachment.
- Project locks and stale jobs may indicate executable failure. Do not clear
  locks without explicit user direction and an understood target project.

Before adding or changing the optional administrator scenario catalog, read
`doc/Test-Scenario-Architecture.md`. Test scenarios hydrate and verify an
application-owned workflow; they do not replace scientific tests, bypass PHP
session authorization, or become public UI2 assets.

## Wiki Updates

To update current GenApp documentation:

1. Edit the sibling checkout at `../genapp.wiki`.
2. Commit and push from that checkout when requested.
3. Return here and run `tools/refresh_github_wiki.sh` so the sync marker records
   the pushed wiki commit.

Do not use old Trac mirrors or `wiki_trac/` material to override the current
GitHub wiki. Archive pages are historical unless the current wiki explicitly
points to them.

## Trac And SVN

Trac and SVN are legacy systems. Do not use them as normal authority or plan
current work around them.

Use them only when the user explicitly requests read-only archaeology or server
inventory. Never commit to SVN, edit Trac pages/databases, change legacy access
files, or modify old server/container state without a separately approved plan.
Do not assume repository files are the live Trac wiki; verify any historical
inventory at the source before relying on it.

## Security And Scientific Computing

- Do not commit passwords, cookies, OAuth or SMTP secrets, access files, private
  keys, database dumps, or server tokens. Be especially careful with
  `appconfig.json`, deployment notes, and imported archive content.
- Verify backups before risky server-side work; do not assume backup status.
- Do not introduce parameter reductions, approximations, or workflow
  simplifications solely to save time in scientific applications.
- Propose optimizations separately with expected impact and obtain approval for
  scientific tradeoffs.
- Prefer correctness, reproducibility, and scientific validity over runtime
  reduction.
- Long-running applications should provide a heartbeat with elapsed time and
  useful progress when available.
- State assumptions and never silently substitute a simpler workflow.

## php7designer SASSIE-Web Addendum

This addendum applies only when work concerns SASSIE, Zazzie, the Zazzie3
deployment, or SASSIE-driven use of GenApp. Do not apply SASSIE-specific module,
science, deployment, or presentation requirements to unrelated GenApp
applications.

### Required cross-repository preflight

Before planning, recommending architecture for, or changing SASSIE-web behavior:

1. Read the applicable `AGENTS.md` in this repository,
   `../genapp_zazzie`, and `../zazzie`.
2. Report their three guardrail Git blob hashes, the governing issue, whether
   SASSIE changes are required, and whether a shared GenApp core or driver/helper
   gap has actually been demonstrated.
3. Inspect the current SASSIE output/stream, application driver, module JSON,
   view, tests, and applicable policy before proposing a new abstraction.
4. Search the affected SASSIE and application packages for current policy,
   contract, README, schema, and maintained test documentation.

Detailed driver, interpolation, simulation, viewer, and module rules belong in
the paired SASSIE repositories. This addendum supplies only the GenApp boundary.
When a shared boundary changes, update its governing policy and the short
routing blocks in every affected repository in the same coordinated change.

SASSIE-web driver, server, and deployment validation uses the complete SASSIE
package installed under ``~/anaconda3``.  Do not treat ``PYTHONPATH=src`` as
runtime evidence for native extensions, and do not repair imports by copying
source or compiled package files.  The detailed rule is
``../zazzie/docs/source/python_environment_and_build_policy.rst``.

### SASSIE-web plotting boundary

The rejected experiment in `ehb54/zazzie#193` is not an implementation guide.
Do not introduce a GenApp `semantic_plot` type, SASSIE scientific-dataset
recorders, plot replay stores, `.scientific_datasets.json`, live file polling,
a second plotting transport, or a migration registry.

The governing issue is `ehb54/zazzie#184`; read
`doc/Plotting-Architecture.md`, consult
`doc/Plotting-Acceptance-Matrix.md` for recorded deployed evidence, and read the
current wiki page `Reference-Plotly`.

- SASSIE owns calculations, units, canonical outputs, and GUI-neutral scientific
  values. The application driver/helper prepares bounded web-facing series.
  GenApp supplies generic output and rendering mechanisms.
- Use stable declared `plotly` output ids, ordered bounded `SASSIE_STREAM`
  updates through the established application driver runtime, and authoritative
  final stdout JSON for completion and reattachment.
- Producers provide scientific identity and relationships, not fixed geometry,
  colors, fonts, line/marker styling, legend policy, modebar, or browser
  lifecycle state.
- Stop when required scientific values are absent; do not reconstruct missing
  science in GenApp core or teach the renderer module-specific meaning.
- Do not migrate another SASSIE module group until the current reference work
  passes deployed normal, expanded/restore, completion, and fresh-window
  reattachment checks.

### Shared simulation-data reporting boundary

Before changing shared SASSIE simulation observations, read
`../zazzie/docs/source/simulation_observables_policy.rst`.

Simulation and analysis producers own unit-labelled energies, temperatures,
pressures, densities, cell geometry, scattering values, uncertainties, and
other scientific observations. Application drivers carry those records and may
prepare bounded display series. GenApp core renders declared generic fields and
plots without learning simulation-module ids, scientific role names, ensemble
semantics, accepted/trial meanings, or physical derivation rules.

New generic transport or renderer work requires a neutral reproduction usable
by opted-in non-SASSIE applications. Missing or inconsistent SASSIE observations
are application/backend gaps, not by themselves GenApp core gaps.

### Plot presentation

Artist-facing SASSIE-web plot presentation is application-owned. Before
changing it, read `../genapp_zazzie/docs/plot_presentation.md` and rollout issue
`ehb54/zazzie#203`.

- Artists edit `../genapp_zazzie/plot_presentations/*.yaml`.
- SASSIE-web views map stable scientific identities to named presentation
  styles; drivers do not emit visual styling.
- Responsive geometry is owned by generic UI2 and the application view, not
  presentation YAML.
- The application compiler generates
  `../genapp_zazzie/ui2/add/js/plot-presentations.js`; authored YAML and the
  generated application asset are committed together when requested.
- GenApp core must remain application-neutral; do not add SASSIE profiles,
  palette names, or scientific roles to core.

### Other SASSIE policy routing

- One-job diagnostic logging and optional selected-job feedback artifacts are governed by `doc/Next-Job-Environment-Settings.md`,
  `doc/Feedback-Job-Attachments.md`,
  `../genapp_zazzie/docs/next_job_diagnostic_logging.md`, and
  `../zazzie/docs/source/logging_policy.rst`. The browser may only arm the
  fixed application declaration; it must not provide arbitrary environment
  variables, values, or command fragments.
- Runtime-event work is governed by `doc/UI2-Job-Event-Protocol.md` and
  `../genapp_zazzie/docs/runtime_event_contract.md`. Their bounded journal is a
  delivery/display cache; normal final outputs own completed-job reattachment.
- SAS interpolation is governed by
  `../zazzie/docs/source/sas_interpolation_policy.rst` and its SASSIE
  implementation. Do not reproduce that policy in GenApp core.
- SasCalc HDF5 writing, derived files, and downstream consumers are governed by
  `../zazzie/docs/source/sascalc_hdf5_policy.rst`. GenApp must not define or
  reinterpret the scientific schema.
- Molecular viewer and NGL payload rules belong to `genapp_zazzie` and the
  generic contract in `doc/NGL-Viewer-Widget.md`; also read
  `../genapp_zazzie/docs/ngl_layered_viewer_contract.md` and the current wiki
  page `Reference-NGL`. GenApp renderers must not interpret SASSIE trials,
  acceptance, milestones, or molecular science.
- UI2 application defects begin in the SASSIE-web view/schema/driver boundary.
  Core changes require the generic shared-gap gate above.

### Zazzie3 operations

- Follow the repository-wide UI2 test-account access rules above whenever using
  the Zazzie3 `codex` or `codex2` account.
- gacpu for `ehb54/genapp` means the requested gacp followed by
  `tools/zazzie3_update_genapp_core.sh`. If the server core checkout is dirty,
  inspect it and use `--stash-dirty` only when preserving those server-side
  changes in a stash is acceptable.
- Do not deploy unreviewed core changes or use Zazzie3 regeneration as a
  substitute for local generic and application-specific validation.
