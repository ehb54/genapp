# UI2 React Workbench

This directory contains the build-time React, TypeScript, Tailwind, and
shadcn-style component source for UI2. The first vertical slice renders the
`monomer_monte_carlo` module. Other modules continue through the plain
JavaScript UI2 renderer.

The React workbench deliberately reuses the existing UI2 field and output DOM
producers through a narrow bridge in `languages/ui2/add/js/ui2.js`. This keeps
GenApp field semantics, local/server file selection, repeat visibility,
submission, polling, Plotly, NGL, and reattachment behavior authoritative in
the established runtime while React owns workspace composition.

Theme styling is owned by the UI2 shell. React components consume the shared
semantic `--ui2-*` CSS variables and should not introduce Bootstrap,
Bootswatch, or per-workbench theme overrides. Native themes are selected at the
document root and include Slate plus Bootswatch-inspired review candidates.

## Build

Node.js 20.19 or newer and pnpm are required for the frontend build:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The production build emits deterministic static assets to:

```text
languages/ui2/add/react/ui2-react.js
languages/ui2/add/react/ui2-react.css
```

Those assets are committed because deployed GenApp applications do not require
Node.js. The normal `genapp --language ui2` assembly copies them into
`output/ui2/react/`.

When source changes, rebuild the static assets and include both source and
bundle changes in the same review.
