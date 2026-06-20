#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
repo_parent="$(cd "${repo_root}/.." && pwd)"

wiki_dir="${GENAPP_WIKI_DIR:-${repo_parent}/genapp.wiki}"
wiki_url="${GENAPP_WIKI_URL:-https://github.com/ehb54/genapp.wiki.git}"
remote_name="${GENAPP_WIKI_REMOTE:-origin}"
remote_branch="${GENAPP_WIKI_BRANCH:-master}"
stamp_file="${GENAPP_WIKI_STAMP:-${wiki_dir}/.genapp_wiki_last_sync}"

if [ ! -d "${wiki_dir}/.git" ]; then
  echo "Cloning GitHub wiki into ${wiki_dir}"
  git clone "${wiki_url}" "${wiki_dir}"
fi

git -C "${wiki_dir}" fetch "${remote_name}" "${remote_branch}"

local_ref="$(git -C "${wiki_dir}" rev-parse HEAD)"
remote_ref="$(git -C "${wiki_dir}" rev-parse "${remote_name}/${remote_branch}")"

if [ "${local_ref}" != "${remote_ref}" ]; then
  echo "Refreshing GitHub wiki checkout"
  git -C "${wiki_dir}" pull --ff-only "${remote_name}" "${remote_branch}"
else
  echo "GitHub wiki checkout is already current"
fi

{
  echo "wiki_dir=${wiki_dir}"
  echo "remote=${remote_name}/${remote_branch}"
  echo "commit=$(git -C "${wiki_dir}" rev-parse HEAD)"
  date -u '+synced_at_utc=%Y-%m-%dT%H:%M:%SZ'
} > "${stamp_file}"

echo "Wrote sync marker: ${stamp_file}"
