# Agent Guardrails

## Communication

When summarizing work or handing off state, use plain language first. Say what
changed, what was verified, what remains uncertain, and the next concrete
steps. Include an approximate count of remaining steps when the work spans more
than one action, so the user can quickly judge scope and progress.
For multi-step work, final responses must include a short next-steps note with
an approximate remaining-step count, even when the immediate requested task is
complete.

## Source Of Truth

The GitHub wiki is the current source of truth for GenApp documentation. Prefer
the local sibling checkout at `../genapp.wiki` for fast, token-efficient reads.

- Refresh the local wiki checkout with `tools/refresh_github_wiki.sh` before
  relying on freshness-sensitive documentation.
- The refresh script clones or updates `../genapp.wiki` from
  `https://github.com/ehb54/genapp.wiki.git` by default.
- Use `GENAPP_WIKI_DIR`, `GENAPP_WIKI_URL`, `GENAPP_WIKI_REMOTE`, or
  `GENAPP_WIKI_BRANCH` only when the user explicitly needs an alternate wiki
  checkout or remote.
- Current entry points include `Home.md`, `Start-Here.md`, `Developer-Guide.md`,
  `Reference.md`, `Wrap-an-Application.md`, and `Tutorial-Demo-App.md`.

Many promoted wiki pages were mechanically imported from old Trac pages. Use
them for GenApp concepts, schema details, and historical context, but treat old
install paths, SVN URLs, host names, OS versions, and deployment commands as
stale unless verified against current local files or explicit user direction.

## GenApp Working Model

GenApp is a generator for science gateway and application interfaces. An
application is described by JSON files plus executable wrappers; GenApp reads
those definitions and emits target-specific application code.

For generator/runtime architecture work, especially new widgets, new usage
patterns, new target behavior, or substantial runtime changes, read
`doc/GenApp-Architecture-Audit.md`. Keep deeper call graphs, extension
checklists, and open architecture questions there rather than expanding this
guardrails file.

Core application layout:

- `directives.json`: global generation and application directives, including
  target languages.
- `menu.json`: menu hierarchy, module grouping, startup/autorun behavior, and
  optional menu restrictions.
- `modules/*.json`: module input/output field definitions and module-level
  behavior such as resource, submit policy, job weighting, help, autosubmit,
  notification, and output fields.
- `bin/`: executable wrappers or programs invoked by modules.
- `add/`: optional static files copied into generated output.
- `<language>/`: optional language-specific overrides. A language-specific
  `directives.json` appends/replaces top-level settings, `menu.json` replaces
  the base menu, `modules/*.json` replaces matching modules, and `add/`
  overwrites after the base `add/` copy.
- `output/<language>/`: generated application output.

Executable wrappers must write valid JSON to stdout. Put diagnostics on stderr
or in files, not stdout, unless the module contract explicitly expects them in
the JSON output.

## Legacy Target Prime Directive

The existing `html5` generated application is production legacy behavior. New
target work such as `ui2` must not silently change `html5` output, deployment
directives, system modules, login/splash behavior, theme selection, Job Manager
columns, or generated runtime assets.

- Prefer target-filtered generation such as `genapp --language ui2` while
  experimenting with `ui2`.
- Regenerate `html5` only when the task explicitly calls for a legacy change or
  legacy verification.
- Treat ignored runtime files such as an app's `directives.json` as deploy
  state; refresh them only from the tracked source intended for that app and
  verify legacy-facing directives before regeneration.
- For Zazzie3, keep `directives.json.docker` and its guardrail checker aligned
  so theme selection, splash docs, Job Manager Details, and other legacy UI
  expectations cannot drift unnoticed.
- If a UI2 experiment needs shared GenApp core changes, add tests proving
  target filtering and legacy generation behavior remain intact.
- For UI2 runtime features, keep behavior in the UI2 core target/runtime and
  let React/shadcn consume it as presentation through the existing bridge unless
  a reviewed architecture decision says otherwise. `ui2-react` is not a
  separate target language. See `doc/GenApp-Architecture-Audit.md` for the
  current action/precheck guidance.

Zazzie3 has a non-admin SASSIE-web test user named `codex` for UI2 runtime
timing and reattach checks. Do not store its password in this file or any
tracked repository file; ask the user or use an approved secret channel when
credentials are needed.

## Repository Map

This repository is the GenApp generator/runtime source, not an application
instance and not the live wiki.

- `bin/`: command-line entry points such as `genapp`, `genapp.pl`,
  `genapp_run.pl`, `genapp_check.pl`, and `check_json.pl`.
- `languages/`: target definitions and templates for generated output
  (`html5`, `docker`, `nodeapi`, `qt*`, `java`, etc.).
- `modules/`: built-in/system module definitions.
- `etc/`: Perl utilities, config samples, tests, templates, and support files.
- `sbin/`: installer and application-management scripts.
- `dockerfiles/`: container build material.
- `tools/`: local maintenance helpers, including GitHub wiki refresh hooks.
- `projects/`, `tmp/`, and `supplementary/`: examples, experiments, migrated
  assets, or support material; inspect freshness before relying on them.

The `genapp` and `genapp.pl` entry points require `GENAPP` to point at this
repository and dispatch to `bin/genapp_run.pl`. `genapp_run.pl` validates the
application directory, reads the language definitions, and assembles generated
files from replacement templates.

## Cross-Repository Work

When a task touches files outside this repository, read and follow the
applicable `AGENTS.md` in each repository or working tree before editing,
testing, deploying, or drawing runtime conclusions about that code. The target
repository's instructions control its interpreter, branch, deployment, testing,
and ownership rules. Do not assume GenApp-local conventions apply to sibling
repositories such as `genapp_zazzie` or `zazzie`.

## GitHub Workflow Preference

For this repository, do not use the Codex GitHub app/connector unless the user
explicitly asks for that connector. Do not probe it first and then fall back to
`gh`; that wastes context and can hit avoidable permission errors.

Use:

- local `git` for branch, status, history, and diff work
- authenticated `gh` CLI for GitHub reads and writes, including issues, pull
  requests, comments, labels, and API calls

Treat the local checkout plus `gh` as the authoritative GitHub workflow for
this repo. For issue or pull request comments, labels, edits, reviews, and other
GitHub writes, go directly to `gh api` or another appropriate `gh` command.

Local shorthand: `gacpu` means `gacp` for the intended GenApp changes, followed
by `tools/zazzie3_update_genapp_core.sh` to update the Zazzie3 container's
GenApp core checkout and regenerate the configured app. If the server core
checkout is dirty, inspect the reported files; rerun with `--stash-dirty` only
when preserving those server-side changes in a stash is acceptable.

## Common Workflows

When working on GenApp itself:

1. Read the relevant current wiki page and the corresponding local source or
   template before editing.
2. Prefer existing generator patterns in `bin/`, `etc/perl/`, and `languages/`.
3. Prefer Perl for new GenApp maintenance code, tests, and harnesses when it is
   practical. GenApp already uses Perl heavily because that matched the original
   author's preference; staying in that language helps keep future maintenance
   sane. Use another language only when it clearly fits the target runtime or
   existing local tooling better.
4. Avoid calling preliminary validation a "smoke test." Prefer clearer phrases
   such as "basic validation," "initial verification," "generation sanity
   check," or "workflow check."
5. Keep generated-output changes separate from generator/template changes unless
   the user explicitly asks for generated artifacts.
6. Validate JSON changes with `bin/check_json.pl` where applicable.
7. Validate application directories with `bin/genapp_check.pl` or by running
   `genapp` from the application base directory when an application fixture is
   available.
8. Put new automated tests under the Perl-native `t/` tree. New additions that
   need coverage should extend that harness unless there is a strong,
   documented reason to use a different test location.
9. For JavaScript-oriented test helpers, prefer a minimal repo-local Node.js
   LTS setup with bundled `npm`, and drive it from the Perl harness instead of
   introducing a separate test runner stack unless the coverage need clearly
   requires it.
10. Treat Linux CI or a Linux container as the authoritative environment for
    JavaScript test results because GenApp production runs on Linux servers.
    Mac results are useful for local developer feedback, syntax checks, and
    quick runtime validation, but they are convenience checks rather than the
    source of truth.

When wrapping or debugging an application:

- Confirm the app base directory contains `directives.json`, `menu.json`, and
  `modules/`.
- Confirm `directives.json` has the expected target language list and an
  `application` value matching the base directory name when required.
- Confirm every menu module id has a matching module JSON file after
  language-specific overrides are considered.
- Confirm module executables exist, are executable where needed, and emit valid
  JSON to stdout.
- Use `safefile` for text fields that represent user-provided paths. Do not
  weaken path validation or allow traversal outside the job tree.

## Runtime And Jobs

For HTML/PHP-style generated applications, `appconfig.json` controls runtime
behavior such as mail, host identity, messaging ports, compute resources,
restricted user groups, default submit policy, job limits, submit blocks, and
MOTD.

- Treat `appconfig.json` as environment-sensitive. Do not invent mail, OAuth,
  host, port, credential, or resource settings.
- A module-level `resource` can override `resourcedefault`.
- A module-level `submitpolicy` can override the global submit policy.
- Job limits apply only to modules that define `jobweight`.
- Job reattach can become confusing if module input/output fields change after
  jobs have run. Preserve ids where possible and call out compatibility risk.
- Project locks and stale jobs may indicate module executable failures; avoid
  clearing locks unless the user explicitly asks and the affected project is
  understood.

## Wiki Updates

To update the current documentation:

1. Edit pages in the sibling wiki checkout at `../genapp.wiki`.
2. Commit and push from that wiki checkout with normal Git commands. The local
   shorthand `gacp` means `git add`, `git commit`, `git push`.
3. Return to this repo and run `tools/refresh_github_wiki.sh` so the sync marker
   records the pushed wiki commit.

Do not use old Trac mirror content or `wiki_trac/` material to override the
GitHub wiki. Archive pages are historical unless the current wiki explicitly
points to them for a specific concept.

## Trac And SVN

Trac and SVN are legacy systems. For normal GenApp work, do not use them, do not
consult them as authoritative sources, and do not plan changes around them.

Use Trac/SVN only when the user explicitly asks for read-only archaeology or
server inventory. In that case:

- Treat access as read-only. If a task appears to require writing to Trac, SVN,
  or old server state, stop and ask for an explicit new plan that prefers the
  current Git/GitHub wiki workflow.
- Do not commit to SVN, edit Trac pages, edit Trac databases, change `.htpasswd`
  files, or modify server/container state.
- Do not assume local repo files are the live Trac wiki. Old Trac wiki pages
  live in a Trac SQLite database on the server, not in this Git repo and not in
  SVN.
- Do not use stale server copies such as `/srv/wiki/genapp.old`,
  `/srv/wiki/genapp.1`, `/srv/wiki/genapp.2`, `/srv/trac/embargo*`,
  `/srv/svn.old`, or `/srv/old`.

Known legacy inventory from June 2026, for read-only context only:

- Public Trac URL: `https://genapp.rocks/wiki`.
- Public host: `genapp.rocks`, IP `149.165.155.215`.
- Reported wiki/SVN host name: `genapp-home-wiki-svn`.
- Persistent server state lives under `/srv`.
- Main Docker container: `genapphome` from image `genapphome:2_u18.04`.
- Live Trac environment: `/srv/wiki/genapp`.
- Trac runs as an old Python 2.7 Apache/mod_wsgi install.
- The old SVN repository is `/srv/svn/base`, also available as `/svn -> /srv/svn`.

## Security

Do not commit passwords, cookies, OAuth secrets, SMTP credentials, `.htpasswd`
content, Trac DB dumps, wiki credential files, private keys, or server-specific
tokens. Be especially careful with `appconfig.json`, mail settings, deployment
notes, old credential pages, and imported archive content.

If backup status matters for any risky server-side action, verify backups
explicitly first. No automated Trac/SVN backup status should be assumed.

## Scientific Computing Guidance

Do not introduce shortcuts, parameter reductions, approximations, or workflow
simplifications solely to save time. Preserve the requested physics, parameter
space, and analysis unless explicitly directed otherwise.

When a shortcut or optimization is possible, propose it separately and explain
the expected impact. Do not apply it without approval.

Prefer correctness, reproducibility, and scientific validity over runtime
reduction.

For long-running jobs, implement a periodic heartbeat ("pulse") indicating the
process is still active. Include elapsed time and useful progress metrics when
available.

Clearly identify all assumptions. Never silently replace requested behavior with
a simpler alternative.

Algorithmic and computational improvements are encouraged, but should be
presented as recommendations for review before adoption.
