#!/bin/sh
# builds the genappalpha-php8 image from this repository
#
# usage: build.sh [-r gitref | -w] [-t base|test] [-a test-apps-dir] [-n image] [-- docker build options]
#   -r gitref   GenApp source = git archive of gitref (default HEAD)
#   -w          GenApp source = the working tree (tracked and untracked, not ignored, files)
#   -t target   base (no applications) or test (default; needs -a)
#   -a dir      directory with the exported test applications (demo tutorial2 mulch), see export-test-apps.sh
#   -n image    image name (default genappalpha-php8); the tag is the target
# the build context is assembled in ./ctx (ignored by git) and left there for inspection

set -eu

here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)

ref=HEAD
worktree=0
target=test
apps=
image=genappalpha-php8

while [ $# -gt 0 ]; do
    case "$1" in
        -r) ref=$2; shift 2 ;;
        -w) worktree=1; shift ;;
        -t) target=$2; shift 2 ;;
        -a) apps=$2; shift 2 ;;
        -n) image=$2; shift 2 ;;
        --) shift; break ;;
        *)  echo "usage: $0 [-r gitref | -w] [-t base|test] [-a test-apps-dir] [-n image] [-- docker build options]" >&2; exit 1 ;;
    esac
done

if [ "$target" = test ] && [ ! -d "$apps/demo" ]; then
    echo "$0: target test needs -a with the exported test applications (see export-test-apps.sh)" >&2
    exit 1
fi

ctx=$here/ctx
rm -rf "$ctx"
mkdir -p "$ctx/genapp"

if [ $worktree = 1 ]; then
    ( cd "$repo" && git ls-files -z --cached --others --exclude-standard | xargs -0 sh -c 'for f; do [ -e "$f" ] && printf "%s\0" "$f"; done' sh | tar --null -T - -cf - ) | tar -xf - -C "$ctx/genapp"
    describe="working tree of $(git -C "$repo" rev-parse --short HEAD)"
else
    git -C "$repo" archive --format=tar "$ref" | tar -xf - -C "$ctx/genapp"
    describe="$(git -C "$repo" rev-parse --short "$ref")"
fi
rm -rf "$ctx/genapp/dockerfiles/genappalpha_php8/ctx"

cp "$here/Dockerfile" "$here/genapp-start" "$here/svn-from-dir" "$here/test-appconfig.php" "$ctx/"
chmod +x "$ctx/genapp-start" "$ctx/svn-from-dir"
if [ "$target" = test ]; then
    mkdir "$ctx/test-apps"
    for app in demo tutorial2 mulch; do
        cp -a "$apps/$app" "$ctx/test-apps/"
    done
fi

echo "building $image:$target from $describe"
docker build --target "$target" -t "$image:$target" "$@" "$ctx"
