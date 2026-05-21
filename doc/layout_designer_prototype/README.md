# GenApp Layout Designer Prototype

This directory contains a static browser prototype for the early GenApp layout
designer discussion.

Open `index.html` in a browser. The prototype provides:

- a live canvas with nested panels and field nodes
- primitive buttons for adding panels and sample fields
- drag/drop movement of fields between panels
- an inspector for panel and field layout properties
- JSON export/import for a template-shaped layout object

The exported JSON intentionally follows the current layout-template direction:
top-level `panels`, role-based `fields` defaults, and sample field layout
assignments. It is not yet wired to the production `layout.js`/`dd.js` runtime;
it is a development surface for checking the interface and round-trip model
before making the designer authoritative.
