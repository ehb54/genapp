# UI2 narrow file-repeater shared-gap report

Status: approved for implementation under `madscatt/zazzie#472`.

## Application symptom

The SASSIE-web Contrast Variation Ensemble Analysis workbench declares an
ordinary tableized repeater containing a local/server file field, a listbox,
and numeric values.  At narrow widths, the selected filename, Local, Server,
and Change actions and later value columns extend beyond the visible card.
Keyboard focus can move the horizontal overflow area, but the remaining
controls are not discoverably accessible.

Changing CVA labels made the source selector readable at normal widths but did
not address the generic narrow layout.  A view-level wide-input layout cannot
create more width when the workbench already occupies the full narrow
container.

## Neutral reproduction

The `ui2_views` workbench fixture contains a five-column tableized repeater
with a listbox, short numeric values, and an `lrfile` input.  At a container
width between approximately 31 and 40 rem, the current generic minimum widths
and compact file-picker action widths require horizontal overflow.  The same
behavior applies without a SASSIE module id or scientific field name.

## Existing-contract gap

Views may place the existing repeater but have no presentation metadata for
changing the internal generic field layout.  File selection, repeated values,
submission, and restoration are owned by UI2, so duplicating the control in a
React view would create a second runtime path.  The generic renderer therefore
needs to preserve its table at wide widths and present the same controls as
labelled rows when its own container is narrow.

## Generic behavior

Every file-bearing tableized repeater opts in automatically through the
existing `ui2-repeat-table-has-file` classification.  Below the generic narrow
container threshold, UI2:

- presents each repeated record as a labelled vertical group;
- keeps file actions visible while allowing the filename display to shrink;
- preserves the existing controls, values, ordering, file-selection state,
  submission keys, repeat conditions, and reattachment behavior; and
- leaves wide file tables and every non-file repeater unchanged.

No new module or view schema is introduced.

## Compatibility, verification, and rollback

The neutral fixture is the opted-in consumer; ordinary repeat tables are the
non-opted-in control.  Verification covers generic markup, narrow and wide CSS
policies, repeated local/server file behavior, generated UI2 assets, and the
SASSIE-web CVA workbench.  HTML5 does not consume this UI2 stylesheet or
renderer path.

Rollback is limited to removing the cell-label metadata and narrow container
rules.  No submitted or saved data format changes.
