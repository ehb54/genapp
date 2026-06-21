#!/bin/sh
# Rebuilds the react-chart-editor bundle and installs it into
# languages/html5/add/_cedit/ (copied verbatim into every generated GenApp
# site's web root as /_cedit/...).
#
# Usage: ./update-assets.sh [docker build args...]
set -eu

cd "$(dirname "$0")"

docker build -t rce-bundle -f Dockerfile "$@" .

rm -rf out
mkdir -p out
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/out:/out" rce-bundle

dest=../../languages/html5/add/_cedit
mkdir -p "$dest"
cp -v out/react-chart-editor.bundle.min.js "$dest/"
cp -v out/react-chart-editor.app.min.js "$dest/"
cp -v out/react-chart-editor.min.css "$dest/"

rm -rf out
