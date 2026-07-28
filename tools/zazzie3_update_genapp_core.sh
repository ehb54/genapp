#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
host="${GENAPP_ZAZZIE_HOST:-zazzie}"
container="${GENAPP_ZAZZIE_CONTAINER:-zazzie3}"
core_dir="${GENAPP_ZAZZIE_CORE_DIR:-/src/genapp}"
gz_dir="${GENAPP_ZAZZIE_GZ_DIR:-/opt/genapp/sassie3}"
branch="${GENAPP_ZAZZIE_CORE_BRANCH:-php7designer}"
ref="${GENAPP_ZAZZIE_CORE_REF:-HEAD}"
generate_mode=""
generate_language=""
stash_dirty=0

usage() {
    cat <<EOF
Usage: tools/zazzie3_update_genapp_core.sh [options]

Safely update the GenApp core checkout inside the zazzie3 container and
regenerate the configured GZ app.

Default:
  host:      $host
  container: $container
  core dir:  $core_dir
  app dir:   $gz_dir
  branch:    $branch
  ref:       $ref

Options:
  --host HOST          SSH host alias or name
  --container NAME     Docker container on the host
  --core-dir PATH      GenApp core checkout inside the container
  --gz-dir PATH        GZ app directory inside the container
  --branch NAME        Core branch to update
  --ref REF            Local ref/commit to require, default HEAD
  --check-only         Check/update core but do not run genapp
  --generate-all       Regenerate every language listed in app directives
  --generate-language LANG
                       Regenerate only one language target, e.g. ui2 or html5
  --stash-dirty        Stash dirty server core changes before updating
  -h, --help           Show this help

Environment:
  GENAPP_ZAZZIE_HOST, GENAPP_ZAZZIE_CONTAINER, GENAPP_ZAZZIE_CORE_DIR,
  GENAPP_ZAZZIE_GZ_DIR, GENAPP_ZAZZIE_CORE_BRANCH, GENAPP_ZAZZIE_CORE_REF
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)
            host="$2"
            shift 2
            ;;
        --container)
            container="$2"
            shift 2
            ;;
        --core-dir)
            core_dir="$2"
            shift 2
            ;;
        --gz-dir)
            gz_dir="$2"
            shift 2
            ;;
        --branch)
            branch="$2"
            shift 2
            ;;
        --ref)
            ref="$2"
            shift 2
            ;;
        --check-only)
            generate_mode="check"
            shift
            ;;
        --generate-all)
            generate_mode="all"
            shift
            ;;
        --generate-language)
            if [[ $# -lt 2 ]]; then
                echo "--generate-language requires a language name" >&2
                exit 2
            fi
            generate_mode="language"
            generate_language="$2"
            shift 2
            ;;
        --stash-dirty)
            stash_dirty=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ -z "$generate_mode" ]]; then
    cat >&2 <<EOF
Choose an explicit generation mode:
  --check-only
  --generate-language ui2
  --generate-language html5
  --generate-all
EOF
    exit 2
fi

if [[ "$generate_mode" = "language" && -z "$generate_language" ]]; then
    echo "--generate-language requires a language name" >&2
    exit 2
fi

required_commit="$(git -C "$repo_root" rev-parse --verify "${ref}^{commit}")"

echo "Updating $host:$container:$core_dir to $branch @ $required_commit"

ssh "$host" docker exec -i "$container" bash -s -- \
    "$core_dir" "$gz_dir" "$branch" "$required_commit" "$generate_mode" "$stash_dirty" "$generate_language" <<'REMOTE'
set -euo pipefail

core_dir="$1"
gz_dir="$2"
branch="$3"
required_commit="$4"
generate_mode="$5"
stash_dirty="$6"
generate_language="${7:-}"

stamp() {
    printf '\n== %s ==\n' "$1"
}

stamp "Preflight"
test -d "$core_dir/.git"
test -d "$gz_dir"
cd "$core_dir"

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$branch" ]]; then
    echo "Switching GenApp core branch: $current_branch -> $branch"
    git checkout "$branch"
fi

dirty="$(git status --porcelain)"
if [[ -n "$dirty" ]]; then
    echo "Container GenApp core has local changes:"
    git status --short
    if [[ "$stash_dirty" != "1" ]]; then
        cat >&2 <<EOF
Refusing to update a dirty server core checkout.
Rerun with --stash-dirty to preserve those changes in a git stash and continue.
EOF
        exit 1
    fi
    echo "Preserving dirty server core changes in a stash."
    git stash push -u -m "zazzie3 core update $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

stamp "Fetch"
git fetch origin "$branch"

if ! git cat-file -e "${required_commit}^{commit}" 2>/dev/null; then
    echo "Required commit is not present after fetch: $required_commit" >&2
    exit 1
fi

stamp "Fast-forward"
git checkout "$branch"
git merge --ff-only "$required_commit"

stamp "Core verification"
core_head="$(git rev-parse HEAD)"
echo "GenApp core HEAD: $core_head"
test "$core_head" = "$required_commit"
test -f languages/html5/js/dynamic_output.js
grep -q 'ga.dynamicOutput' languages/html5/add/js/ga.min.js

if [[ -f "$gz_dir/plotting_migration.json" ]]; then
    stamp "Plotting architecture verification"
    "$core_dir/tools/check_plotting_architecture.pl" "$gz_dir"
fi

if [[ "$generate_mode" = "check" ]]; then
    echo "Check-only requested; not regenerating $gz_dir"
    exit 0
fi

stamp "Generate"
cd "$gz_dir"
. /etc/profile

html5_index_before=""
ui2_index_before=""
if [[ "$generate_mode" = "language" && "$generate_language" != "html5" && -f output/html5/index.html ]]; then
    html5_index_before="$(stat -c '%Y:%s' output/html5/index.html)"
fi
if [[ "$generate_mode" = "language" && "$generate_language" != "ui2" && -f output/ui2/index.html ]]; then
    ui2_index_before="$(stat -c '%Y:%s' output/ui2/index.html)"
fi

case "$generate_mode" in
    all)
        GENAPP="$core_dir" genapp
        ;;
    language)
        GENAPP="$core_dir" genapp --language "$generate_language"
        ;;
    *)
        echo "Unsupported generation mode: $generate_mode" >&2
        exit 2
        ;;
esac

stamp "Generated runtime verification"
if [[ "$generate_mode" = "all" || "$generate_language" = "html5" ]]; then
    test -f output/html5/js/ga.min.js
    grep -q 'ga.dynamicOutput' output/html5/js/ga.min.js
fi
if [[ "$generate_mode" = "all" || "$generate_language" = "ui2" ]]; then
    test -f output/ui2/index.html
    test -f output/ui2/js/ui2.js
    test -f output/ui2/css/ui2.css
    test -f output/ui2/react/ui2-react.js
    test -f output/ui2/react/ui2-react.css
    if [[ -d output/html5 ]]; then
        ln -sfn ../ui2 output/html5/ui2
        test -f output/html5/ui2/index.html
    fi
fi
if [[ -n "$html5_index_before" ]]; then
    html5_index_after="$(stat -c '%Y:%s' output/html5/index.html)"
    if [[ "$html5_index_after" != "$html5_index_before" ]]; then
        echo "output/html5/index.html changed during $generate_language-only generation" >&2
        exit 1
    fi
fi
if [[ -n "$ui2_index_before" ]]; then
    ui2_index_after="$(stat -c '%Y:%s' output/ui2/index.html)"
    if [[ "$ui2_index_after" != "$ui2_index_before" ]]; then
        echo "output/ui2/index.html changed during $generate_language-only generation" >&2
        exit 1
    fi
fi

if [[ -d "$core_dir/tools/ai_helper_service" ]]; then
    stamp "AI Helper service deployment"
    service_source="$core_dir/tools/ai_helper_service"
    service_dir="$gz_dir/.local/ai_helper_service"
    mkdir -p "$service_dir"
    find "$service_source" -maxdepth 1 -type f \
        ! -name ".env" \
        ! -name "usage.json" \
        ! -name "ai_helper.log" \
        ! -name "ai_helper.pid" \
        ! -name "ai_helper_supervisor.pid" \
        -exec cp {} "$service_dir"/ \;
    chmod +x "$service_dir/ai_helper_server.py" \
        "$service_dir/run_forever.sh" \
        "$service_dir/start.sh" \
        "$service_dir/stop.sh" \
        "$service_dir/restart_if_needed.sh" \
        "$service_dir/install_service.sh"
    "$service_dir/install_service.sh" --service-dir "$service_dir"
    /etc/init.d/ai-helper-service status
fi

stamp "Post-generate core cleanup"
cd "$core_dir"
core_dirty="$(git status --porcelain)"
if [[ "$core_dirty" = " M languages/html5/add/js/ga.min.js" ]]; then
    echo "Restoring generated ga.min.js drift in the GenApp core checkout."
    git restore languages/html5/add/js/ga.min.js
elif [[ -n "$core_dirty" ]]; then
    echo "GenApp core checkout became dirty during generation:" >&2
    git status --short >&2
    exit 1
fi

cd "$gz_dir"
version_dir="output/$generate_language/etc"
if [[ "$generate_mode" = "all" ]]; then
    version_dir="output/html5/etc"
fi
mkdir -p "$version_dir"
cat > "$version_dir/genapp_core_version.json" <<EOF
{
  "core_dir": "$core_dir",
  "branch": "$branch",
  "commit": "$required_commit",
  "generate_mode": "$generate_mode",
  "generate_language": "$generate_language",
  "generated_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Generated $gz_dir with GenApp core $required_commit"
REMOTE
