---
created: 2026-11-10
updated: 2026-11-10
type: feature
reporter: jari
status: untriaged
priority: normal
provenance: other
provenance_detail: Jari 10.11.2026, Contoso pilot; split from m365-teams-files-and-messages direction 2
source_ref: taskfleet:01m72a87fs3bc4k0f73bdsg4sa/split:m365-teams-messages
originating_run: 01m72a87fs3bc4k0f73bdsg4sa
originating_run_kind: spinoff
---

# Microsoft 365: the agent cannot read the person's Teams chats and channel messages

## Description

Jari, 10 Nov 2026 (Contoso pilot): a person's agent cannot reach the person's
Microsoft Teams chats or channel messages. This was direction 2 of
`m365-teams-files-and-messages`. Direction 1, Teams channel files, landed
there; Jari decided that messages wait for their own design.

Current state: the Microsoft 365 integration syncs OneDrive, followed
SharePoint sites and joined Teams' libraries (rclone), and gives the agent
Outlook mail, calendar and contacts through ms-365-mcp-server
(`--preset mail,calendar,contacts`, `internal/daemon/integrations/microsoft_linux.go`).
No Teams chat or channel-message tool is offered, and the levels
(`microsoftLevelScopes`) request no `Chat.Read`/`ChannelMessage.Read.All`.

To design with Jari:
- Read-only reach to chats and channel messages, either through the MS 365
  MCP server's Teams tools or Graph directly.
- `ChannelMessage.Read.All` and similar scopes need administrator consent
  in most tenants, so this is a per-tenant decision with a visible
  administrator request (compare the Atlassian card), and it decides which
  levels carry these scopes.
- What the agent may read on the person's behalf (all chats, or chosen
  ones) is a product and privacy decision.
