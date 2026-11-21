---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: ADR 0037 implementation (technical decision run)
source_ref: taskfleet:01m7yk9bnzwbee7v6r48ecfy6e/adr-0037-implementation:daemon
originating_run: 01m7yk9bnzwbee7v6r48ecfy6e
originating_run_kind: technical-decision
preparation: pending
related: ['@person-removal']
---

# Daemon: disconnect a person's services at the providers before removal

## Description

# Daemon: disconnect everything before a person's removal

Implements section 4 of ADR 0037 (`docs/decisions/adr-0037-person-removal.md`).

A gateway-built request only (never on the agent listener) that, as the person and with their own credentials only:

- revokes integration tokens at providers that allow self-revocation with the token (Google revoke endpoint, Dropbox `token/revoke`, GitLab `personal_access_tokens/self`) and then removes the local entries as each tool's logout does;
- removes local entries where no such revocation exists (Microsoft public-client tokens, IMAP/DAV app passwords, Gitea tokens) and reports `local_only`;
- stops sync clients and logs the person's own Tailscale node out of their tailnet;
- leaves `gh` alone (its token's only copy goes with the home).

The reply carries counts per provider and outcome (`revoked`, `local_only`, `failed`), never an account name, address or token. Repeating the request is harmless. Contract change starts in `contracts/v1/`.
