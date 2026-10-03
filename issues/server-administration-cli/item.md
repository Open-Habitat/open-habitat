---
created: 2026-10-03
updated: 2026-10-03
type: task
status: open
priority: normal
related: ['@named-server-admin-settings']
---

# Provide a privileged server administration CLI

# Provide a privileged server administration CLI

## Goal

Provide the operator-side administration path for shared server settings and user roles, including appointing a browser administrator after installation. A server must remain usable with no browser administrator, including disposable test installs.

## Boundaries

The [server-name and browser-admin feature](../named-server-admin-settings/item.md) owns the product behavior; its authorization architecture is not yet settled. Design this CLI against that decision, not as a second source of roles or settings. Operator/OS maintenance authority stays distinct from the browser administrator role. An ordinary browser administrator must not gain other users' files, credentials or conversations, and the browser must not gain the CLI's privileged operations.

Implement the supported shared-setting and role-management actions through the appropriate privileged operator path once the architecture is decided, with clear authorization, non-interactive operation, useful errors and verification on a disposable server. The equivalent browser-admin actions and the CLI should agree on outcomes where their authority overlaps. Do not assume that installing the server creates an administrator.

This issue does not broaden the existing root provisioning broker's first-login authority without an explicit architectural decision. Do not lane it until the shared settings/role architecture is decided.
