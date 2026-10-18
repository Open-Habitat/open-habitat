# Integrations for agents: OpenClaw reuse, candidates and agent exposure

Research for [agent-integrations](../agent-integrations/item.md), read on
2026-10-17; Jari's answers of 2026-10-18 are in that epic's decisions and
folded in below. The architecture decision that follows this is still to be
recorded as an ADR.

## The problem

People should be able to connect their other systems so that their agents
can use the data: SharePoint and OneDrive files into the home directory the
way OneDrive does on a laptop, Google Drive, Gmail, calendars. OpenClaw has
built integration points for the same purpose, and the hope was that an
integration made for OpenClaw would work here automatically, even if our
browser UI looks different. The open questions were which integrations come
first, how each is realistically implemented, how an agent learns that the
data exists, and how credentials stay inside the Unix-user boundary.

## What we found

**OpenClaw's integrations are mostly skills that call ordinary CLIs.** Its
data integrations (Gmail, Drive, Notion, Trello, mail, Obsidian) are Agent
Skills: a `SKILL.md` that teaches the agent to call a command-line tool
(`gog`, `himalaya`, `curl`) which keeps its own login. Beside those it has
in-process TypeScript plugins (model providers, chat channels such as Slack
and Teams, memory) and a generic MCP client. Credentials go into one
gateway-wide secret store, and OpenClaw's own documentation says a gateway
is "one trust domain" and that for mutually untrusted people you run one
gateway per tenant. Our model is the opposite: each person is a Unix user.

**The skill layer and MCP transfer directly; the rest does not.** Pi 1.3.0,
which we already run, implements the same Agent Skills specification, reads
`~/.agents/skills/` (which OpenClaw and Codex also read), and has its own MCP
client with OAuth. So an OpenClaw skill works here with no adapter when the
CLI it calls is installed on the host and the person has logged it in as
themselves. Three things break the "automatic" promise: the CLI must be
installed by the operator, since users cannot install system packages; a
login on a headless server needs the browser to carry the OAuth redirect;
and a skill that uses OpenClaw-only tools (its `secrets` tool, node exec,
channel tools) does not work. OpenClaw's native plugins, its secret store and
its gateway-level MCP configuration cannot be reused and should not be,
because each assumes one trusted operator.

**Realistic routes per integration.**

| Integration | Route | Where the data lands |
|---|---|---|
| OneDrive and SharePoint files | A sync client running as the user: [abraunegg/onedrive](https://github.com/abraunegg/onedrive) or [rclone](https://github.com/rclone/rclone/blob/master/docs/content/onedrive.md), both handle SharePoint libraries. Microsoft's own MCP server needs extra licences and caps files at 5 MB. | A directory in the home, counted against the person's quota ([ADR 0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md)). Agents use ordinary file tools. |
| Google Drive | rclone sync of chosen folders, or a CLI for on-demand reads. Google Docs need export. | A directory in the home. |
| Gmail and Google Calendar | A CLI the agent calls: `gog` (OpenClaw's skill) or Google's community-maintained [`gws`](https://github.com/googleworkspace/cli). Google's own Gmail and Calendar MCP servers are preview and Workspace-only. | Nothing is synced; results enter the conversation and so Pi's history. |
| Outlook mail and calendar | Not researched in this round. | |
| Slack as a data source | Slack's official MCP server, OAuth with a registered Slack app and workspace-admin approval. | Nothing is synced. |
| Notion | Hosted MCP server, OAuth only, no app registration needed. | Nothing is synced. |
| GitHub | Already done (`gh`). | |

Two facts cut across Google and Microsoft. First, someone has to register
an OAuth application: Google's and Microsoft's tools need a registered
client, and rclone's shared default client is not recommended for real use.
Google treats Gmail and full Drive access as restricted scopes: an app in
"Testing" status is limited to listed test users and its tokens expire after
7 days; real use needs Google's verification. A Testing-mode client with
Jari's accounts is enough for the test server, not for a product. Second,
the registered client is app identity, not a credential broker: one client
configured host-wide holds nobody's data, and each person's tokens are still
issued to and stored by their own tool. Tenants and workspaces may also
require admin consent, which we cannot test with Jari's accounts alone.

**How agents learn about an integration.** Pi discovers skills from
`~/.agents/skills/` and its own directories, loads only name and description
into the system prompt, and reads the body when relevant; `/reload` picks up
changes in a running session. MCP servers in `~/.pi/agent/mcp.json` announce
themselves through their `description`. The natural mechanism is therefore
one skill per integration in `~/.agents/skills/<name>/`, which also serves
Codex and OpenClaw, plus an `mcp.json` entry when the integration is an MCP
server. Editing the person's own `~/.pi/agent/AGENTS.md` or generating
system-prompt text from the daemon would mix machine text into their files
and create a second source of truth.

**Security under the Unix-user boundary.** Every tool above keeps its
tokens in its own store inside the person's home (rclone's config, the
onedrive config directory, `gog`'s file keyring, Pi's `mcp-auth.json`), so
the host stores nothing new and no root component touches integration
state. The daemon can do everything needed as that user: run the tool's
login and pass the URL and redirect through the browser, write the skill and
the MCP entry, run the tool's status command, and remove what it created. A
shared OAuth client may be host-wide; tokens, synced directories and sync
processes never cross users. The real risk is agent exposure: anything
synced or fetched is readable by every agent the person runs, and a
prompt-injected document can ask the agent to send mail or move files with
the person's authority. Pi's documentation says the same. The UI should say
plainly that agents can read and act on connected data.

Background sync needs a process. The daemon is socket-activated, so nothing
runs when nobody is connected; continuous sync would need a new per-user
unit started by root, which is new host surface.

## Recommendation

**A catalog of native integrations driven by the person's daemon.** Each
catalog entry names one native tool (sync client, CLI or MCP server), its
login flow kind, the status command and the skill text. The browser's
integration page lists the entries with status computed live from the
tools themselves, so nothing is stored about what is connected. Adding one
runs the tool's login as the user, writes the skill and, for MCP, the
`mcp.json` entry; removing it removes both. This fits both root rules,
reuses OpenClaw skills as content, and leaves the person free to install
other skills and MCP servers by hand. The cost is login-flow glue per tool,
which breaks when a CLI changes its prompts, and an operator package list.

Alternatives considered: install-only, where the operator installs the tools
and people log in from a terminal, works for power users but not for a
browser-only person on a remote server; running an OpenClaw gateway per
user would bring the most features but adds a second agent platform beside
Pi, against [ADR 0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md);
MCP only cannot put SharePoint files into the home directory and leaves
most OpenClaw skills unused, so it is one flow kind inside the catalog
rather than the design.

## Decided and open

Jari decided on 2026-10-18 (recorded in the epic):

- Start with Google Drive and SharePoint, and with their mail and calendars.
  Outlook mail and calendar still need the research the Google side got.
- Default access is read and write, not read-only.

Still open, in plain terms:

1. **Who registers the OAuth applications.** Google and Microsoft want the
   application that asks for access to be registered by someone. Either the
   installation operator registers one Google and one Microsoft application
   and every user logs in through it, with each person's tokens staying their
   own, or each person registers their own, which almost nobody will do.
   Recommendation: the operator registers them.
2. **Should files keep syncing when nobody has the browser open?** That
   needs a new per-user process on the host. The alternative is syncing when
   the person or the agent asks, like a clone job
   ([ADR 0024](../../docs/decisions/adr-0024-clone-jobs.md)).
   Recommendation for the prototype: on demand.
3. **The catalog design itself**, as described above.

## Suggested prototype round

Google first, since one registered application covers Drive, Gmail and
Calendar: Gmail and Calendar through `gog` or `gws`, Drive as an on-demand
rclone sync into the home. Then SharePoint and OneDrive files as an
on-demand rclone or onedrive sync. Outlook mail and calendar after their
route is researched.

## Not verified

- Whether Claude sessions through pi-claude-bridge (ADR 0016) see Pi's
  skills and MCP tools or only Claude Code's own `~/.claude/skills`.
- Whether the daemon can drive the tools' logins non-interactively with a
  pasted redirect; each tool's prompts were read from documentation, not
  exercised.
- Microsoft's and Google's MCP offerings are recent and in preview; their
  terms come from vendor documentation and third-party summaries read on
  2026-10-17.

## Sources

- OpenClaw repository, commit `235647734fb59541878f1033c7eefcde6d3ca6c2`:
  [docs/tools/skills.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md),
  [docs/plugins/manifest.md](https://github.com/openclaw/openclaw/blob/main/docs/plugins/manifest.md),
  [docs/plugins/bundles.md](https://github.com/openclaw/openclaw/blob/main/docs/plugins/bundles.md),
  [docs/tools/mcp.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/mcp.md),
  [docs/tools/secrets.md](https://github.com/openclaw/openclaw/blob/main/docs/tools/secrets.md),
  [docs/concepts/multi-user.md](https://github.com/openclaw/openclaw/blob/main/docs/concepts/multi-user.md),
  [docs/start/teams.md](https://github.com/openclaw/openclaw/blob/main/docs/start/teams.md),
  [skills/gog/SKILL.md](https://github.com/openclaw/openclaw/blob/main/skills/gog/SKILL.md),
  `skills/{notion,himalaya,trello,mcporter,clawhub}/SKILL.md`, `docs/cli/skills.md`.
- Pi 1.3.0 installed documentation: `docs/skills.md`, `docs/mcp.md`,
  `docs/configuration.md`, `docs/packages.md`, `docs/settings.md`,
  `docs/security.md`, `docs/how-pi-works.md`.
- [Agent Skills specification](https://agentskills.io/specification);
  [Codex: build skills](https://learn.chatgpt.com/docs/build-skills).
- Google: [Configure the Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-servers),
  [Workspace developer update, May 2026](https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html),
  [googleworkspace/cli](https://github.com/googleworkspace/cli),
  [OAuth 2.0 refresh token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).
- Microsoft: [rclone OneDrive docs](https://github.com/rclone/rclone/blob/master/docs/content/onedrive.md),
  [abraunegg/onedrive usage](https://github.com/abraunegg/onedrive/blob/master/docs/usage.md) and
  [advanced usage](https://github.com/abraunegg/onedrive/blob/master/docs/advanced-usage.md),
  [Scalekit: OneDrive MCP vs API](https://www.scalekit.com/blog/onedrive-mcp-vs-api),
  [Scalekit: Microsoft 365 MCP vs Graph](https://www.scalekit.com/blog/microsoft365-mcp-vs-api).
- Slack: [Slack MCP server overview](https://docs.slack.dev/ai/slack-mcp-server/).
- Notion: [Connect to Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp).
- Open Habitat: [identity-and-trust](../../docs/architecture/identity-and-trust.md),
  ADR [0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md),
  [0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md),
  [0024](../../docs/decisions/adr-0024-clone-jobs.md),
  `systemd/open-habitat-daemon@.service`.
