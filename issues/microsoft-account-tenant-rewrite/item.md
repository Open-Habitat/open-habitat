---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [internal/daemon/integrations]
---

# Existing Microsoft accounts keep the old 'common' tenant in their native configs

## Description

Found by `microsoft-tenant-migration` (2026-10-24): an existing Microsoft account's rclone config in the person's home keeps the tenant from its sign-in time (`common` on the test server). After the site's Microsoft app becomes single-tenant (GUID tenant, now the only supported form), that works only while the Entra registration stays multi-tenant; once it is single-tenant, file-sync token refresh fails (AADSTS50194) until the person signs in again.

Goal: when the site's Microsoft app tenant differs from what an existing account's native configs hold, the daemon brings the person's own native configs (rclone remote, MSAL/MCP wrapper config) to the current tenant at its next start/check, inside the person's UID, without a new sign-in where the refresh token remains valid for that tenant; where it cannot, the card says to sign in again with the concrete reason.

## Acceptance Criteria

- [ ] Test: an account written with `common` is rewritten to the GUID tenant; refresh then uses the tenant endpoint (fake token endpoint); failure path shows the reason.
- [ ] Review: focused self-review plus one targeted reviewer (credential config rewrite).
