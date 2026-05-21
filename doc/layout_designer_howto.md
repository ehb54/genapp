# GenApp Layout Designer How-To

This guide describes the current GenApp layout designer prototype as integrated into the local SASSIE/GenApp Docker development app.

The designer is still an early development tool. It is useful for seeing and shaping module layout in the real running web app, but it is not yet a complete production layout editor.

## What The Designer Is

The layout designer is an admin/designer-only mode inside the generated GenApp web UI.

When Designer is enabled, the normal module view is wrapped with layout editing controls:

- a left-side primitive/control panel
- orange layout outlines on fields and panels
- selectable fields and panels
- panel controls for rows, columns, gap, and alignment
- field movement controls
- undo for designer edits
- save/load draft controls
- bottom inspection tabs for details, layout JSON, module data, dictionary data, and controls

The important idea is that the center/right area is not a mock canvas. It is the live GenApp module HTML with designer chrome layered on top.

## What It Can Do Today

The current designer can:

- turn designer mode on and off from the main GenApp page
- show a left-side palette beside the live module
- render real module fields with layout outlines
- show nested panels from the module's `panels` structure
- distinguish normal module fields from GenApp runtime-owned fields
- show injected runtime objects, including:
  - Submit
  - Reset
  - progress/status spans
  - messages/output spans
  - output textarea slot
- add primitive panels/fields from the left panel
- select fields and panels
- move fields between layout positions
- change panel column/row presets
- change panel gap/alignment
- resize field span/width with designer controls
- undo layout edits
- save and load layout drafts locally through the Docker app
- inspect the generated layout/module/control data in bottom tabs
- warn about some layout problems, such as runtime collisions or missing runtime parents

## What It Cannot Do Yet

The current designer cannot yet:

- safely replace hand-editing for all module JSON layout work
- guarantee perfect round-trip serialization for every existing module
- fully edit every legacy GenApp layout concept, such as `norow`, repeaters, and old section/header conventions
- provide polished drag-and-drop behavior for every edge case
- infer ideal layout from old modules automatically
- automatically decide the best placement for every runtime-owned object
- edit all possible field type details
- manage complex repeater layouts as a finished workflow
- validate every possible visual overlap
- export a final reviewed pull-request-ready module layout without developer inspection

Treat it as a live layout workbench, not yet as the only source of truth.

## Runtime-Owned Objects

GenApp injects several objects that are not ordinary authored module fields. The designer now treats them as layout objects so their placement is visible and controllable.

Common runtime-owned objects are:

- `b_submit`
- `b_reset`
- `${moduleid}_progress`
- `${moduleid}_output_airavata`
- `${moduleid}_output_msgs`
- `${moduleid}_output_textarea`

These are marked as runtime-owned in the designer. They should usually be placed in a `controls` panel or another explicitly chosen runtime panel.

By default, the runtime-owned objects are placed after authored fields in the `controls` panel:

```text
controls
  authored controls/plots
  Submit / Reset
  progress
  airavata output
  messages output
  output textarea
```

Modules can override this with a top-level `runtime_layout` object in the module JSON.

Example:

```json
{
  "runtime_layout": {
    "submit": {
      "parent": "controls",
      "location": [8, 1],
      "label": "none",
      "data": [1, 1]
    },
    "reset": {
      "parent": "controls",
      "location": [8, 2],
      "label": "none",
      "data": [1, 2]
    },
    "textarea": {
      "parent": "controls",
      "location": [12, 1],
      "label": "none",
      "data": [1, [1, 3]]
    }
  }
}
```

Use generic runtime keys like `submit`, `reset`, `progress`, `messages`, and `textarea` unless there is a reason to target the exact generated field id.

## How To Open The Designer

1. Start the local Docker GenApp/SASSIE app.
2. Open the local web app, usually:

```text
http://localhost:8080/sassie3/
```

3. Log in with an account that has admin/designer access.
4. Find the `Designer` checkbox near the top-right menu area.
5. Turn `Designer` on.
6. Open a module from the normal GenApp menu.

The module will open with the left designer panel and layout outlines.

## Basic Workflow

1. Open the module you want to inspect.
2. Turn Designer on.
3. Look at the live module area.
4. Select a field or panel by clicking its outlined region.
5. Use the left controls to adjust layout.
6. Use Undo immediately if an edit goes wrong.
7. Use Save Draft to preserve a working version.
8. Use the bottom tabs to inspect generated layout details.
9. Turn Designer off to preview the normal app view.

Use small edits and save often. The editor is intentionally conservative, but it is still a prototype.

## Moving Fields

Field movement is intended to be done through the designer controls rather than freeform dragging across the whole page.

Recommended approach:

1. Click the field you want to move.
2. Click the target panel or target area.
3. Use `Move Field Here`.
4. Check the result.
5. Use Undo if the placement was not what you wanted.

Avoid large sideways drag motions for now. Earlier versions interpreted some lateral moves as removal-like operations, and although that has been improved, controlled moves are still safer.

## Adjusting Panels

When a panel is selected, the left controls can adjust:

- columns
- rows
- gap
- alignment

Useful starting choices:

- `1 column` for simple vertical stacks
- `2 columns` for label/data layouts
- `3 columns` or `4 columns` for denser forms
- `label/data` for traditional GenApp field rows

Click `Apply Panel` after choosing panel options.

## Collapsible Panels

Use collapsible panels when a module has a large input region and the user needs to focus on outputs after the setup phase.

There are two current ways to create one:

1. Click the `Collapsible Input` primitive to add a new collapsible label/data panel.
2. Select an existing panel, check `Collapsible`, choose whether it should be `Open by default`, then click `Apply Panel`.

When a panel is collapsible, the live module gets a small `Hide <panel>` / `Show <panel>` button. The panel starts open by default unless `Open by default` is unchecked.

Recommended first use:

- make `inputpanel` collapsible
- keep it open by default
- keep output/runtime panels visible below it

This preserves the normal module flow while letting users collapse the inputs after they have chosen parameters and submitted a job.

## Adjusting Fields

When a field is selected, the designer can adjust some layout properties such as span and width.

Use this for cases like:

- making a text input wider
- letting an output object span multiple columns
- keeping a button compact
- making plot/output areas occupy more space

Runtime-owned fields can be moved and inspected, but be cautious: they are generated by GenApp and may be expected by runtime code.

## Working With Textarea Output

GenApp output textarea objects are normally hidden at runtime until needed.

In Designer mode, the output textarea is forced visible so its layout slot can be seen and adjusted. When Designer is off, normal hidden runtime behavior is preserved.

If you see an empty orange runtime row, check whether it is one of the output spans or textarea slots. Some runtime output fields are intentionally empty until a job runs.

## Drafts

Use Save Draft and Load Draft while experimenting.

Drafts are local development artifacts. They are useful for designer iteration but should not be treated as final reviewed module changes without inspecting the resulting JSON.

Recommended rhythm:

1. Open module.
2. Save Draft before risky edits.
3. Make a small set of changes.
4. Save Draft again if the result is good.
5. Use Load Draft if you need to return to the saved version.

## Debugging Layout Problems

If a module looks wrong:

1. Confirm Designer is on.
2. Check whether the field is module-owned or runtime-owned.
3. Open the bottom `Details` tab and look for warnings.
4. Check the `Layout` tab for parent, row, and column placement.
5. Turn Designer off to see whether the issue is only designer chrome or real app layout.
6. Reload the page if regenerated assets changed.
7. Use Undo if the problem followed a designer edit.

Common causes:

- field assigned to the wrong parent panel
- runtime object colliding with authored fields
- old module layout assumptions conflicting with CSS Grid
- hidden runtime output object being visible only in Designer mode
- cached browser assets after regeneration

The local app uses cache-busted designer assets, but a reload is still often useful after regeneration.

## Recommended Safe Practice

For now, use the designer this way:

1. Use it to inspect the live module layout.
2. Use it to test panel/field organization.
3. Use it to identify where runtime-owned objects land.
4. Save drafts during exploration.
5. Review generated JSON before treating it as source.
6. Commit only deliberate GenApp/designer changes, not local Docker compatibility edits.

The designer is already useful for answering layout questions visually. The next step is hardening the round-trip workflow so a designer-edited module can be saved as a clean, reviewed module template with less manual inspection.
