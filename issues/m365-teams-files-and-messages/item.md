---
created: 2026-11-10
updated: 2026-11-10
type: feature
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Jari 10.11.2026, Contoso pilot
source_ref: conversation:jari-2026-11-10/teams
lane: m365-teams
lane_seq: 1
collision: [internal/daemon/integrations/microsoft_files_linux.go]
preparation: ready
closed: 2026-11-10
closed_by: claude
---

# Microsoft 365: the agent cannot reach the person's Teams files and messages

## Description

## Description

Jari 10.11.2026, Contoso pilot: a person's agent cannot reach the person's
material in Microsoft Teams.

What the code does today (`internal/daemon/integrations/microsoft_files_linux.go`):
the Microsoft 365 file sync covers the person's OneDrive and the SharePoint
sites they **follow** (`/me/followedSites`), with each site's document
libraries. Nothing asks for joined teams, channels or chats, and the
Microsoft app registrations request no Teams scopes (no `Chat.Read`,
`ChannelMessage.Read.All`, `Team.ReadBasic.All`). So:

- **Files shared in Teams** live in each team's SharePoint site (and private
  or shared channels in sites of their own). They reach the agent only if
  the person happens to follow that site in SharePoint. Most people never do,
  so team files look missing.
- **Teams chats and channel messages** are not reachable at all.

Directions to design with Jari:
1. Team files: also discover the sites of the person's joined teams
   (`/me/joinedTeams` → each team's group drive, plus private/shared channel
   sites through the channel's `filesFolder`), offered in the same folder
   chooser. Needs `Team.ReadBasic.All` (user consent in most tenants) or reads
   through group membership; check what the current scopes already allow.
2. Messages: chats and channel messages for the agent (read-only), through
   the MS 365 MCP server or Graph directly. These scopes need administrator
   consent in most tenants, so it is a per-tenant decision with a visible
   administrator request, like the Atlassian card.

Related: the same session showed one SharePoint site left out with Graph
`itemNotFound` (analysed in the Contoso integration worker's issue); that
site's name suggests a Teams channel site, so (1) may be the same cause.

## Decisions

### 2026-11-10T08:47:32Z · @jari

Jari 10.11.: fix it so that Teams channels' files come along: direction 1 (joined teams' and their channels' file sites in the same folder chooser), built directly, not as a prototype or experimental feature. Messages (direction 2) stay for later design.

## Resolution

### 2026-11-10T09:33:30Z · @claude

Direction 1 (Teams channel files) landed: joined teams' and private/shared channels' libraries in the Microsoft folder choice, with Team.ReadBasic.All and Channel.ReadBasic.All on every level and teams_left_out for what is missing. Direction 2 (chats and channel messages) is split into m365-teams-messages. Tenant app registrations still need the two permissions added (result.md).
