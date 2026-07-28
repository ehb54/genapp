# UI2 React Workbench

This directory contains the build-time React, TypeScript, Tailwind, and
shadcn-style component source for UI2. The first vertical slice renders the
`monomer_monte_carlo` module. Other modules continue through the plain
JavaScript UI2 renderer.

The React workbench reuses existing UI2 field producers and runtime transport
through a narrow bridge in `languages/ui2/add/js/ui2.js`. This keeps GenApp
field semantics, local/server file selection, repeat visibility, submission,
polling, ordered event delivery, and reattachment authoritative in the
established runtime while React owns workspace composition.

Plotting follows `doc/Plotting-Architecture.md` and `ehb54/zazzie#193`.
Semantic dataset events cross the bridge, while the native React plot component
owns normalized plot state, responsive behavior, accessibility, visual policy,
and renderer translation. Plotly is an adapter below that component, not a
module, driver, or cross-repository contract. NGL remains a separate viewer
concern.

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
