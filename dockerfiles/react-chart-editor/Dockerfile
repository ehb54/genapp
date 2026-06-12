###############################################################################
# react-chart-editor bundle builder for GenApp / static hosting
#
# What this builds (written to /out inside the container):
#   - react-chart-editor.bundle.min.js   (self-contained IIFE bundle:
#                                        React + ReactDOM + Plotly + editor)
#   - react-chart-editor.app.min.js      (tiny “mount” helper; no JSX/Babel)
#   - react-chart-editor.min.css
#   - react-chart-editor.bundle.min.js.map  (optional; see INCLUDE_SOURCEMAP)
#
# Why this exists:
#   - Avoids "Uncaught ReferenceError: global is not defined" in browsers by
#     defining `global` as `globalThis` at build time (no HTML shim needed).
#   - Avoids in-browser Babel and avoids needing separate React UMD files.
#
# Build:
#   docker build -t rce-bundle -f Dockerfile .
#
# Export artifacts to ./out (recommended: keep host ownership, not root:root):
#   mkdir -p out
#   docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/out:/out" rce-bundle
#
# Optional: include sourcemap (larger; useful for debugging):
#   docker build -t rce-bundle --build-arg INCLUDE_SOURCEMAP=1 .
#
# Suggested HTML usage (no Babel; place files next to _chart_edit.html):
#   <link rel="stylesheet" href="react-chart-editor.min.css">
#   <script src="react-chart-editor.bundle.min.js"></script>
#   <script src="react-chart-editor.app.min.js"></script>
#   <div id="editor-root"></div>
#
# Pin versions for reproducible builds (examples):
#   docker build -t rce-bundle \
#     --build-arg RCE_TAG=v0.46.1 \
#     --build-arg PLOTLY_DIST_VERSION=2.35.2 \
#     --build-arg ESBUILD_VERSION=0.24.0 \
#     --build-arg NODE_MAJOR=20 \
#     .
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
    'import PlotlyEditor, { DefaultEditor } from "./lib/index.js";' \
    '' \
    'globalThis.ReactChartEditor = {' \
    '  React: (React && React.default) ? React.default : React,' \
    '  ReactDOM: (ReactDOM && ReactDOM.default) ? ReactDOM.default : ReactDOM,' \
    '  Plotly: (Plotly && Plotly.default) ? Plotly.default : Plotly,' \
    '  PlotlyEditor: (PlotlyEditor && PlotlyEditor.default) ? PlotlyEditor.default : PlotlyEditor,' \
    '  DefaultEditor: (DefaultEditor && DefaultEditor.default) ? DefaultEditor.default : DefaultEditor,' \
    '};' \
    > bundle-entry.js; \
  mkdir -p dist; \
  # NOTE: Some upstream deps still reference the Node-style `global` identifier.
  # In browsers, that doesn't exist (use globalThis). We fix this at build time
  # so the consuming HTML does *not* need shims.
  ESBUILD_FLAGS="--bundle --platform=browser --packages=bundle --format=iife --minify --loader:.js=jsx --define:global=globalThis --define:process.env.NODE_ENV=\"production\" --outfile=dist/react-chart-editor.bundle.min.js"; \
  if [ "${INCLUDE_SOURCEMAP}" = "1" ]; then ESBUILD_FLAGS="$ESBUILD_FLAGS --sourcemap"; fi; \
  npx esbuild bundle-entry.js $ESBUILD_FLAGS; \
  echo "Built:"; \
  ls -lh dist/react-chart-editor.bundle.min.js; \
  if [ "${INCLUDE_SOURCEMAP}" = "1" ] && [ -f dist/react-chart-editor.bundle.min.js.map ]; then ls -lh dist/react-chart-editor.bundle.min.js.map; fi; \
  ls -lh lib/react-chart-editor.min.css; \
  \
  # Build a tiny optional helper script that mounts the editor WITHOUT Babel,
  # and WITHOUT requiring React/ReactDOM globals. This is useful for your
  # GenApp iframe page: it can just load the bundle + this script.
  printf '%s\n' \
    '(function(){' \
    '  "use strict";' \
    '  const RCE = globalThis.ReactChartEditor || {};' \
    '  const React = RCE.React;' \
    '  const ReactDOM = RCE.ReactDOM;' \
    '  const Plotly = RCE.Plotly;' \
    '  const PlotlyEditor = RCE.PlotlyEditor;' \
    '  const DefaultEditor = RCE.DefaultEditor;' \
    '' \
    '  if (!React || !ReactDOM || !Plotly || !PlotlyEditor || !DefaultEditor) {' \
    '    console.error("Missing expected ReactChartEditor globals", RCE);' \
    '    return;' \
    '  }' \
    '' \
    '  const { useState, useEffect } = React;' \
    '' \
    '  function App(){' \
    '    const initial = globalThis.GENAPP_INITIAL_FIGURE || { data: [], layout: {} };' \
    '    const [figure, setFigure] = useState(initial);' \
    '' \
    '    useEffect(() => {' \
    '      const handleMessage = (e) => {' \
    '        if (e && e.data && e.data.type === "LOAD_CHART") {' \
    '          setFigure(e.data.payload || { data: [], layout: {} });' \
    '        }' \
    '      };' \
    '      window.addEventListener("message", handleMessage);' \
    '      return () => window.removeEventListener("message", handleMessage);' \
    '    }, []);' \
    '' \
    '    return React.createElement(' \
    '      "div",' \
    '      { style: { height: "calc(100vh - 45px)" } },' \
    '      React.createElement(' \
    '        PlotlyEditor,' \
    '        {' \
    '          data: figure.data,' \
    '          layout: figure.layout,' \
    '          plotly: Plotly,' \
    '          useDefaultConfig: true,' \
    '          onUpdate: (data, layout) => setFigure({ data, layout }),' \
    '        },' \
    '        (editorProps) => React.createElement(DefaultEditor, editorProps)' \
    '      )' \
    '    );' \
    '  }' \
    '' \
    '  const el = document.getElementById("editor-root");' \
    '  if (!el) { console.error("Missing #editor-root"); return; }' \
    '' \
    '  if (typeof ReactDOM.createRoot === "function") {' \
    '    ReactDOM.createRoot(el).render(React.createElement(App));' \
    '  } else {' \
    '    ReactDOM.render(React.createElement(App), el);' \
    '  }' \
    '})();' \
    > app-entry.js; \
  npx esbuild app-entry.js --bundle --platform=browser --format=iife --minify --outfile=dist/react-chart-editor.app.min.js; \
  ls -lh dist/react-chart-editor.app.min.js

CMD sh -lc 'set -eu; \
  mkdir -p /out; \
  cp -av dist/react-chart-editor.bundle.min.js /out/; \
  cp -av dist/react-chart-editor.app.min.js /out/; \
  if [ "${INCLUDE_SOURCEMAP:-0}" = "1" ] && [ -f dist/react-chart-editor.bundle.min.js.map ]; then cp -av dist/react-chart-editor.bundle.min.js.map /out/; fi; \
  cp -av lib/react-chart-editor.min.css /out/; \
  echo; \
  echo "Copied build artifacts to /out:"; \
  ls -lah /out'
