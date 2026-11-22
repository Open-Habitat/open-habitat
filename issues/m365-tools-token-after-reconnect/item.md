---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/m365-tools-token-after-reconnect
lane: unlaned
preparation: ready
---

# Microsoft tools say the token expired while the integration card says ok

## Description

Test server (pilot.853, 22.11.2026; first seen 16.11.): in a long-running conversation the Microsoft areas (ms-mail list-mail-messages, ms-files search-sharepoint-sites) answer 'Failed to acquire token for account … Please re-login with: --login' while 'open-habitat agent integration list' at the same moment shows every service state ok, access full. Five open-habitat-mcp-relay microsoft --area … relays run under the Pi; no Microsoft server process is visible in ps. After reconnecting an account the open conversation's tools never got the new sign-in and the agent is not told to start a new conversation. Also: ms-files has no whole-account search (search-onedrive-files needs a driveId), and an old ~/cloud/onedrive/<account>/ copy from before the search-based design is still on disk though the skill says nothing is copied. The readable-mcp-server-names doc is stale (servers are now ms-admin/ms-calendar/ms-contacts/ms-files/ms-mail).
