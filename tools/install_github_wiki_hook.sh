#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
hook_path="${repo_root}/.git/hooks/post-merge"
refresh_script="${repo_root}/tools/refresh_github_wiki.sh"

if [ -f "${hook_path}" ] && ! grep -q "refresh_github_wiki.sh" "${hook_path}"; then
  backup_path="${hook_path}.backup.$(date -u '+%Y%m%dT%H%M%SZ')"
  cp "${hook_path}" "${backup_path}"
  echo "Backed up existing post-merge hook: ${backup_path}"
fi

cat > "${hook_path}" <<HOOK
#!/usr/bin/env bash
set -euo pipefail

"${refresh_script}" || {
  echo "warning: GitHub wiki refresh failed; run tools/refresh_github_wiki.sh manually" >&2
  exit 0
}
HOOK

chmod +x "${hook_path}"
echo "Installed post-merge hook: ${hook_path}"
