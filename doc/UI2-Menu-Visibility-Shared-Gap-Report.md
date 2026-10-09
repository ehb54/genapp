# Deployment-specific UI2 menu visibility

Governing issue: https://github.com/ehb54/zazzie/issues/312

## Gap and existing contracts

An application embeds an optional administrator page through `embedded_page`.
A deployment where the page is disabled still shows its menu entry. Existing
menu restrictions control group access, not deployment-specific module visibility.
A target-specific menu override can remove the entry, but requires maintaining
an entire replacement menu. Views and module output contracts cannot express
this generation-time navigation selection.

## Neutral reproduction and contract

The maintained `ui2_views` fixture has ordinary modules `shared`, `plain`,
`typed`, and `workbench_layout`. Setting `ui2_hidden_menu_items: ["plain"]`
should omit only `plain` from its navigation map while preserving its generated
module definition and all other entries. No provider is involved.

Use a generic array of exact module IDs in directives, validated against the
effective UI2 menu. Safely encode it into the generated app map and skip listed
registrations. Omitted/empty directives retain existing registrations. Renderer,
module metadata, backend assembly, authorization, direct URLs, saved jobs, and
HTML5 behavior are unchanged. Unknown/malformed entries fail UI2 generation.

## Consumers, compatibility, and approval

An opted-in deployment may hide its unavailable embedded administrator tool.
NIST and other non-opted-in deployments retain the existing embedded page and
menu. Do not set a nonempty list in the shared application example. Protected
Login.gov configuration, identity blocks, PIV behavior, and authentication PHP
are excluded. No scientific SASSIE work or driver gap is involved.

The owner approved the plan and exact repository manifest in the task, explicitly
including this shared GenApp change. Deployment is a separate approval phase;
no NIST deployment change is part of this task.

## Validation and rollback

Executable generated-map checks cover omitted/empty lists, neutral single and
multiple selections, duplicate IDs, invalid/unknown entries, empty groups,
target overrides, and retained module metadata. HTML5 generation ignores the
option. Existing UI2 and external-auth regressions remain required.

Rollback removes the directive and regenerates UI2. It requires no database,
account, identity-provider, or endpoint changes.
