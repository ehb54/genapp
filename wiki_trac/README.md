# GenApp Trac Wiki Mirror

This directory keeps editable Trac wiki source in Git before anything is
published to the live GenApp wiki.

The live wiki is:

```text
https://genapp.rocks/wiki
```

## Credentials

Create a local credential file from the template:

```sh
cp wiki_trac/.env.example wiki_trac/.env
```

Then fill in `TRAC_USERNAME` and `TRAC_PASSWORD` in `wiki_trac/.env`. That file
is ignored by Git.

Use a dedicated Trac user such as `codex-wiki` with minimal wiki permissions:

```text
WIKI_VIEW
WIKI_MODIFY
```

Add attachment permissions only if the project needs uploaded images/files.

## Server Setup

Publishing through the preferred path requires the Trac XML-RPC plugin endpoint:

```text
https://genapp.rocks/wiki/login/xmlrpc
```

At the time this scaffold was created, that endpoint returned `404`, so
read-only mirroring works now but publishing will not work until XML-RPC is
enabled on the Trac server.

## Workflow

Fetch a page into the mirror:

```sh
python3 tools/trac_wiki.py fetch docs
```

Edit the resulting source file:

```text
wiki_trac/pages/docs.trac
```

Review changes with Git:

```sh
git diff -- wiki_trac/pages/docs.trac
```

After review, publish the page:

```sh
python3 tools/trac_wiki.py publish docs --comment "Update docs page"
```

Check endpoint status:

```sh
python3 tools/trac_wiki.py status
```

## Notes

The `fetch` command uses Trac's public `?format=txt` wiki export, so it does
not require credentials for public pages. The `publish` command uses XML-RPC
and reads credentials from `wiki_trac/.env`.
