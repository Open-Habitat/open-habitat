---
created: 2026-11-16
updated: 2026-11-16
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: chat:2026-11-16/atlassian-signin-stuck-starting
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-16
closed_by: claude
commits:
- hash: 94658cb3
  summary: relay Atlassian's server-specific MCP callback and fail an unrelayable sign-in at once
---

# Atlassian sign-in stays on 'Starting the sign-in…' and fails after five minutes

## Description

Jari 16.11.2026 on a pilot installation (v0.1.2): Settings › Integrations › Atlassian (Confluence). The dialog "Connect a Atlassian account" shows "Starting the sign-in…" with a spinner almost immediately and never progresses; no authorization link or code appears.

Host log (redacted): POST /api/v1/integrations/login returned 200 after 1512 ms (05:38:15Z); no further integration events; at 05:43:14Z the daemon logged integration_login provider=atlassian outcome=failed phase=login reason=tool_failed. So the login request was accepted, the browser never received the authorization step, and the helper timed out after about five minutes.

Also: the title says "Connect a Atlassian account" (article should follow the provider name: "an Atlassian account", or avoid the article).

Expected: the sign-in shows Atlassian's authorization link/page promptly, or a specific error right away if the helper cannot start.
