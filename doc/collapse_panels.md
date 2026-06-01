# Collapsible Panels

Experimental manual panel minimization for the CSS-grid panel runtime.

This feature is opt-in through panel metadata. It does not change legacy
modules, and it does not automatically collapse panels during submit or result
handling.

## Panel Metadata

Add a `ui` object to a non-root panel definition:

```json
{
  "inputpanel": {
    "parent": "body",
    "size": ["auto", 1],
    "location": [1, 1],
    "ui": {
      "title": "Inputs",
      "collapsible": true,
      "default_state": "expanded",
      "summary_fields": ["run_name", "pdbfile"]
    }
  }
}
```

Supported keys:

```text
title          Display title for the panel toggle.
collapsible    Enables manual collapse/expand for this panel.
default_state  Optional. Use "collapsed" to start collapsed.
summary_fields Optional field ids to show in the collapsed summary line.
```

`root` is intentionally not collapsible.

## Runtime Behavior

`layout.js` renders lightweight panel chrome only for panels with
`ui.collapsible`. Designer rendering does not include this chrome, and runtime
initialization is skipped in designer mode.

`panel.js` owns the browser behavior:

```text
ga.panel.init(module, layout)
ga.panel.toggle(module, panel)
ga.panel.set(module, panel, state)
ga.panel.expandForValidation(module)
ga.panel.summary(module, panel, ui)
```

Submit validation expands any manually collapsed panels before checking inputs.
This keeps legacy visible-field validators and field-level warning messages from
being hidden behind a collapsed panel.

The first implementation is manual-only. Automatic lifecycle behavior such as
collapse on job start or expand on completion should be added separately after a
stable job-accepted hook is identified.

Collapsed state is kept in memory only. No browser storage or cross-session
state is written by this feature.
