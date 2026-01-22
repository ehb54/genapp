###############################################################################
# react-chart-editor bundle builder (single-file JS, includes React + Plotly)
#
# Purpose:
#   Build a stand-alone browser bundle:
#     - react-chart-editor.bundle.min.js   (includes React + ReactDOM + Plotly)
#     - react-chart-editor.min.css
#
# Output:
#   Artifacts are copied to /out inside the container. Use a bind mount to
#   collect them on the host.
#
# Quick start:
#   docker build -t rce-bundle .
#   mkdir -p out
#   docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/out:/out" rce-bundle
#
# Override pins (recommended to keep builds reproducible):
#   docker build -t rce-bundle \
#     --build-arg RCE_TAG=v0.46.1 \
#     --build-arg PLOTLY_DIST_VERSION=2.35.2 \
#     --build-arg ESBUILD_VERSION=0.24.0 \
#     --build-arg NODE_MAJOR=20 \
#     .
#
# Optional: include sourcemap (large; useful for debugging)
#   docker build -t rce-bundle --build-arg INCLUDE_SOURCEMAP=1 .
#
# Notes:
# - react-chart-editor has legacy peer-dep constraints; we use npm
#   --legacy-peer-deps to keep npm v7+ from failing dependency resolution.
# - We generate bundle-entry.js with printf (not heredoc) because heredocs
#   can end up empty depending on how the Dockerfile is generated/edited.
# - The resulting bundle may contain "eval" (esbuild warns). If you later add
#   a strict CSP, you may need 'unsafe-eval' for this page.
###############################################################################

FROM debian:latest

ENV DEBIAN_FRONTEND=noninteractive

# Toolchain pins
ARG NODE_MAJOR=20

# What to build
ARG RCE_TAG=v0.46.1

# Bundling pins
ARG ESBUILD_VERSION=0.24.0
ARG PLOTLY_DIST_VERSION=2.35.2

# 0 = no sourcemap (default), 1 = include sourcemap in /out
ARG INCLUDE_SOURCEMAP=0
ENV INCLUDE_SOURCEMAP=${INCLUDE_SOURCEMAP}

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && node -v && npm -v \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work

RUN git clone --depth 1 --branch "${RCE_TAG}" https://github.com/plotly/react-chart-editor.git
WORKDIR /work/react-chart-editor

RUN npm install --legacy-peer-deps \
 && npm run build

RUN npm install --no-save --legacy-peer-deps \
      esbuild@${ESBUILD_VERSION} \
      plotly.js-dist-min@${PLOTLY_DIST_VERSION}

RUN set -eu; \
  printf '%s\n' \
    'import React from "react";' \
    'import ReactDOM from "react-dom";' \
    'import Plotly from "plotly.js-dist-min";' \
    'import { PlotlyEditor, DefaultEditor } from "./lib/index.js";' \
    '' \
    'globalThis.ReactChartEditor = {' \
    '  React,' \
    '  ReactDOM,' \
    '  Plotly,' \
    '  PlotlyEditor,' \
    '  DefaultEditor,' \
    '};' \
    > bundle-entry.js; \
  mkdir -p dist; \
  ESBUILD_FLAGS="--bundle --platform=browser --packages=bundle --format=iife --minify --loader:.js=jsx --outfile=dist/react-chart-editor.bundle.min.js"; \
  if [ "${INCLUDE_SOURCEMAP}" = "1" ]; then ESBUILD_FLAGS="$ESBUILD_FLAGS --sourcemap"; fi; \
  npx esbuild bundle-entry.js $ESBUILD_FLAGS; \
  echo "Built:"; \
  ls -lh dist/react-chart-editor.bundle.min.js; \
  if [ "${INCLUDE_SOURCEMAP}" = "1" ] && [ -f dist/react-chart-editor.bundle.min.js.map ]; then ls -lh dist/react-chart-editor.bundle.min.js.map; fi; \
  ls -lh lib/react-chart-editor.min.css

CMD sh -lc 'set -eu; \
  mkdir -p /out; \
  cp -av dist/react-chart-editor.bundle.min.js /out/; \
  if [ "${INCLUDE_SOURCEMAP:-0}" = "1" ] && [ -f dist/react-chart-editor.bundle.min.js.map ]; then cp -av dist/react-chart-editor.bundle.min.js.map /out/; fi; \
  cp -av lib/react-chart-editor.min.css /out/; \
  echo; \
  echo "Copied build artifacts to /out:"; \
  ls -lah /out'
