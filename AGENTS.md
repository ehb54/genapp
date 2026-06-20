# Agent Guardrails

## GenApp Trac Wiki And SVN Operations

The GenApp public wiki is an old Trac instance at:

```text
https://genapp.rocks/wiki
```

Access is indirect. SSH access is available through `zazzie`
(`zazzie.genapp.rocks`), and that path may be needed to reach the actual
wiki host, machine, or container. Do not assume local repo files are the live
wiki.

Known inventory from June 2026:

- Public host: `genapp.rocks`, IP `149.165.155.215`.
- Host name reported for the wiki/SVN server: `genapp-home-wiki-svn`.
- Important persistent state lives under `/srv` on the host.
- Main Docker container: `genapphome` from image `genapphome:2_u18.04`.
- The container is started with `/srv:/srv`, so host `/srv` and container
  `/srv` are the same live data.
- Trac is an old Python 2.7 install served by Apache/mod_wsgi.
- Live Trac environment: `/srv/wiki/genapp`.
- Live Trac config: `/srv/wiki/genapp/conf/trac.ini`.
- Live Trac database: `/srv/wiki/genapp/db/trac.db`.
- HTTP Basic Auth file: `/srv/wiki/genapp/.htpasswd`.

Critical wiki guardrails:

- Wiki pages live in the Trac SQLite database, not in this Git repo and not in
  SVN.
- Prefer Trac web UI or `trac-admin /srv/wiki/genapp ...` for wiki/user/admin
  work.
- Do not edit `db/trac.db` directly unless explicitly directed and after a
  backup.
- Do not edit stale copies such as `/srv/wiki/genapp.old`, `/srv/wiki/genapp.1`,
  `/srv/wiki/genapp.2`, `/srv/trac/embargo*` backups, `/srv/svn.old`, or
  `/srv/old`.
- When operating inside Docker, use the live `genapphome` container. Ignore
  Guacamole containers for docs/wiki work.

Trac admin commands should be run inside the live container, for example:

```sh
sudo docker exec -it genapphome bash
trac-admin /srv/wiki/genapp permission list
```

The main wiki is distinct from the embargo Trac instances under
`/srv/trac/embargoN`. Those have separate Trac environments and separate
`.htpasswd` files.

## SVN Notes

There is one real SVN repository:

```text
/srv/svn/base
```

It is also available as `/svn -> /srv/svn`. Project names such as `genapp`,
`sassie2`, `somo`, `rotdif`, and `willitfit` are subdirectories/scopes within
that one repository, not independent repositories.

Trac registers about 20 named repositories that map to subdirectories of the
single SVN tree, for example `/svn/base/<projectname>`.

SVN serving notes:

- `svnserve -d` serves `/srv/svn/base` on port `3690`.
- `anon-access = read`.
- `auth-access = write`.
- Authz is effectively empty, so any valid SVN write account can write anywhere
  in the repository.
- Do not assume embargoed projects are protected at the SVN layer. Embargo
  protection is only through separate Trac/web layers.

Before committing to SVN, inspect an existing working copy with `svn info` to
confirm whether the expected URL convention is `svn://genapp.rocks/<project>`
or `svn://genapp.rocks/base/<project>`.

## Local Wiki Mirror

This repo contains a local Trac wiki mirror scaffold in `wiki_trac/`.

- Tracked page sources live under `wiki_trac/pages/*.trac`.
- Local credentials belong in `wiki_trac/.env`, which is ignored by Git.
- Use `tools/trac_wiki.py fetch <page>` to mirror public page source through
  Trac's `?format=txt` endpoint.
- Use `tools/trac_wiki.py publish <page>` only after Trac XML-RPC is enabled
  and credentials are configured.

Do not commit passwords, cookies, `.htpasswd` content, Trac DB dumps, or other
server secrets.

## Backups

No container crontab was found for automated SVN/wiki backup or sync jobs.
If backup status matters, verify it explicitly before making risky server-side
changes.

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
