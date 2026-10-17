# Integrations for agents: OpenClaw reuse, candidates and agent exposure

Research for [agent-integrations](../agent-integrations/item.md), 2026-10-17.
It ends in a recommendation for the architecture decision; it is not an ADR.

## Summary

OpenClaw has no single integration format. Its data integrations (Gmail,
Drive, Notion, Trello, mail, Obsidian…) are almost all **Agent Skills**: a
`SKILL.md` that teaches the agent to call an ordinary CLI (`gog`, `himalaya`,
`ntn`, `curl`) which keeps its own login. Beside those it has in-process
TypeScript **plugins** (model providers, chat channels such as Slack and
Teams, memory) and a generic **MCP client**. Its credentials go into a
gateway-wide secret store, and its documentation says plainly that a shared
gateway is "one trust domain".

The reusable part is the skill-plus-CLI layer and MCP. Pi 1.3.0, which we
already run, implements the same Agent Skills specification, reads
`~/.agents/skills/` (which OpenClaw also reads), and has its own MCP client
with OAuth, keeping tokens in `~/.pi/agent/mcp-auth.json`. So an OpenClaw
skill whose CLI is installed and logged in as the person already works here,
with no adapter. OpenClaw's native plugins, its secret store and its
gateway-level MCP configuration cannot be reused, and should not be: each one
assumes one trusted operator.

**Recommendation (option B below):** an integration is a small catalog entry
that names one native tool (sync client, CLI or MCP server), a login flow and
a skill. The person's daemon runs the native tool's own login as that user,
the tool stores its own token, and the daemon writes the skill into
`~/.agents/skills/<name>/` and, for MCP, an entry in `~/.pi/agent/mcp.json`.
The browser shows the flow and the status. The host stores nothing new.
Start with Google (Gmail, Calendar, Drive) and Microsoft 365 (OneDrive and
SharePoint files) because those are what Jari named.

Two things are for Jari to decide before a prototype: who registers the OAuth
apps (Google, Microsoft, Slack all want a registered client), and whether a
file sync may run in the background when nobody has the browser open (that
needs a new long-running per-user process).

## 1. OpenClaw's integration model

Read from the repository at commit `235647734fb5` (17 October 2026, MIT
licence) and its `docs/`.

| Integration point | What it is | Credentials | Reusable here? |
|---|---|---|---|
| **Skills** (`skills/*/SKILL.md`, 50 bundled) | [AgentSkills](https://agentskills.io/specification) directory with frontmatter. OpenClaw adds `metadata.openclaw` with `requires.bins`/`env`/`config`, `primaryEnv`, `os` and `install` hints (brew/node/go/uv) for gating and its macOS UI. | None in the skill; the CLI it calls keeps its own login. Optional `skills.entries.<name>.env/apiKey` injected per turn from OpenClaw config. | **Yes, directly.** Pi ignores the unknown `metadata` key. Gating and installer hints are ours to read if wanted. |
| **Native plugins** (`extensions/*`, 182, `openclaw.plugin.json`) | TypeScript running inside the OpenClaw gateway against its SDK: providers, channels (Slack, Teams, Discord, iMessage, IMAP…), memory, web search, Control UI widgets. | Config + secret store of the gateway. | **No.** They need OpenClaw's runtime. Many are chat *channels* (talking to the agent from Slack), a different feature from giving the agent data. |
| **Bundles** | OpenClaw imports "Agent Plugins" (`plugin.json`, [agent-plugins.org](https://agent-plugins.org)), Claude (`.claude-plugin/`), Codex and Cursor packs, mapping their skills, commands and MCP config into its own features. | As MCP below. | **The idea, yes.** Pi packages are the equivalent; Pi does not read Claude plugin bundles. |
| **MCP client** (`mcp.servers` in `openclaw.json`) | stdio, Streamable HTTP and SSE; Settings → MCP in the Control UI; `openclaw mcp add/doctor/login`. | OAuth tokens held by the gateway; "per-requester identity" exists for some servers. | **Same servers, different config file.** Pi uses the common `mcpServers` JSON shape. |
| **Secrets tool** | The agent asks the human for a key through a masked prompt; the gateway writes it into "the shared secret store". | Gateway-owned store. | **No.** This is a host credential broker, which our root instructions rule out. |
| **ClawHub** | Registry: `openclaw skills install @owner/<slug>`, also `skills-sh:` and `git:` sources. | – | Skills from it are plain skill directories and would work if copied. A registry is not needed for the first round. |

**Trust model.** [docs/start/teams.md](https://github.com/openclaw/openclaw/blob/main/docs/start/teams.md#one-trust-boundary):
"A gateway is one trust domain. Everyone who can message a tool-enabled agent
shares that agent's delegated tool authority." For mutually untrusted people
it says to run one gateway per tenant. Multi-user mode, personal skill
libraries and per-person model accounts are explicitly "not security
boundaries". Our model is the opposite: each person is a Unix user. That is
why OpenClaw's management plane (who installs what, where secrets live)
cannot be copied even though its content can.

**Where our UI differs.** OpenClaw's Control UI edits one gateway-wide config
as an administrator. Ours would act only inside the signed-in person's home,
through their daemon, with no administrator role in the flow. OpenClaw's
skill pages read gating metadata to show "ready / missing binary / missing
env"; the same readiness idea is useful to us, but computed by the daemon from
the person's own `PATH` and the native tool's own status command (for
example `gog auth list --check`, `rclone about`, `pi mcp list`).

**"Integration made for OpenClaw works here automatically."** True for the
common case, with three conditions: (1) the CLI the skill calls is installed
on the host (an operator package decision, since users cannot install system
packages); (2) the person has logged it in, which on a headless server needs a
browser-carried login flow (section 3); (3) the skill does not rely on
OpenClaw-only tools (`exec host=node`, the `secrets` tool, channel tools).
Native OpenClaw plugins never work automatically.

## 2. Candidate integrations

Order reflects Jari's words (SharePoint, Google Drive, Gmail first) and then
what a person working with agents usually needs. "Effort" is for the first
working version in the product, assuming the option B design.

| Integration | Realistic route | Data lands | Login on a headless host | Effort |
|---|---|---|---|---|
| **OneDrive / SharePoint files** | **Sync client into `~`**: [abraunegg/onedrive](https://github.com/abraunegg/onedrive) (`--monitor`, one config dir per library, SharePoint libraries by drive ID) or [rclone](https://github.com/rclone/rclone/blob/master/docs/content/onedrive.md) (`drive_type = documentLibrary`, `bisync` or one-way `sync`). Agent then uses ordinary file tools. Microsoft's official [ODSP MCP server](https://www.scalekit.com/blog/onedrive-mcp-vs-api) needs Agent 365 / Copilot licences and caps files at 5 MB, so it is not a general answer. | `~/Integrations/onedrive/…` or `~/Integrations/sharepoint/<site>/<library>/`; counts against the person's quota ([ADR 0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md)). | abraunegg prints a URL and accepts the pasted redirect; rclone needs `rclone authorize` or a pasted token. Tenants may require admin consent for the app. | Medium–large: the sync process lifecycle, conflict and delete safety (abraunegg's `classify_as_big_delete`), quota. |
| **Google Drive** | Same split: `rclone` (type `drive`) sync of chosen folders, or a CLI for on-demand reads. Google Docs need export (rclone exports to docx/xlsx/pdf). | `~/Integrations/google-drive/…` | rclone remote auth as above. | Medium. |
| **Gmail** | **CLI the agent calls**: `gog` (OpenClaw's own skill) or Google's community-maintained [`gws`](https://github.com/googleworkspace/cli) (README: "not an officially supported Google product"; ships its own skills). Alternative: Google's [Gmail MCP server](https://developers.google.com/workspace/guides/configure-mcp-servers) (`gmailmcp.googleapis.com`), developer preview, Workspace accounts, own OAuth client required. Plain IMAP via `himalaya` for non-Google mail. | Nothing synced; mail stays at Google, results enter the conversation (and therefore Pi's history). | `gog --remote --step 1/2` or `--manual` (paste redirect URL); `gws auth login`. Gmail scopes are Google "restricted" scopes (see below). | Small for the skill; the login flow is the work. |
| **Google Calendar** | Same CLI (`gog calendar`, `gws calendar`) or the Calendar MCP server. | Nothing synced. | Same Google login, more scopes. | Small once Gmail exists. |
| **Slack** (as a data source) | Slack's [official MCP server](https://docs.slack.dev/ai/slack-mcp-server/) at `mcp.slack.com/mcp` (GA Feb 2026), OAuth with a registered Slack app and workspace-admin approval. | Nothing synced. | MCP OAuth with a **confidential** client (client secret) per Slack's docs. | Small–medium; admin approval is outside our control. Slack *as a chat channel to the agent* (OpenClaw's plugin) is a separate, larger feature. |
| **Notion** | [Hosted MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp) at `mcp.notion.com/mcp`, OAuth only, interactive; or OpenClaw's `notion` skill with an integration token in `NOTION_API_TOKEN`. | Nothing synced. | Pi's MCP OAuth with dynamic registration; the loopback redirect must be carried from the browser. | Small. Good first MCP test because it needs no client registration from us. |
| GitHub | Already done (`gh`, [identity-and-trust](../../docs/architecture/identity-and-trust.md)). | – | – | – |
| Later candidates | Linear, Jira/Confluence, Trello (OpenClaw skill: `curl` + env token), Obsidian vault (just files), 1Password `op` for secrets the person already keeps there. | | | |

Facts that cut across Google and Microsoft:

- **OAuth client registration is unavoidable.** Google's MCP servers and
  `gws`/`gog` need an OAuth client; rclone ships a shared default client but
  recommends your own. Google treats Gmail and full Drive scopes as
  restricted: an app in "Testing" status is limited to listed test users and
  its refresh tokens expire after 7 days; production use needs Google's
  verification. Google's [OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2#expiration)
  states the 7-day expiry for Testing-status external apps.
  For the test server, a Testing-mode client with Jari's accounts as test
  users is workable; it is not a product answer.
- **The client ID is app identity, not a credential broker.** One client
  registered by the installation operator and configured host-wide does not
  hold anyone's data; each person's tokens are still issued to and stored by
  their own native tool. A client secret for a "desktop" client is not
  confidential in Google's model; Slack's confidential client is, and would
  have to be readable by every user's tool, which is acceptable only for a
  secret whose disclosure gives no one access to another person's data.
  This is a decision for Jari (section 6).

## 3. How agents learn about integrations

What Pi 1.3.0 supports natively (installed docs under
`@earendil-works/pi-coding-agent/docs/`):

- **Skills** (`skills.md`): Agent Skills spec. Discovered from
  `~/.pi/agent/skills/`, `~/.agents/skills/`, project `.pi/skills/` and
  `.agents/skills/` up to the repository root, plus `skills` paths in
  settings. Only name, description and path enter the system prompt; the body
  is read when relevant. `/reload` picks up changes in a running session. User
  skills need no project trust.
- **MCP** (`mcp.md`): `~/.pi/agent/mcp.json` (user) and `.pi/mcp.json`
  (project, only after trust), the common `mcpServers` format, `pi mcp add/
  list/login/logout` from a shell. HTTP OAuth with dynamic registration,
  a configured client, or Pi's own client-ID metadata document; tokens in
  `~/.pi/agent/mcp-auth.json`. A server's `description` puts it in the
  `mcp_servers` section of the system prompt; tools are reached through
  `codemode`, `tool_search` or declared directly (`exposure`). For a remote
  browser it accepts a pasted redirect URL.
- **Context files** (`configuration.md`): `~/.pi/agent/AGENTS.md` (global
  instructions), `APPEND_SYSTEM.md` (added to the system prompt), plus
  `AGENTS.md`/`CLAUDE.md` from the working directory upward.
- **Packages** (`packages.md`): npm/git bundles of skills, extensions and
  prompts, installed into `~/.pi/agent/settings.json`.

Choice: **one skill per integration in `~/.agents/skills/<name>/`.** It is
the location shared by Pi, OpenClaw and Codex
([Codex skills](https://learn.chatgpt.com/docs/build-skills), which reads
`$HOME/.agents/skills`), so the same file serves every harness except Claude Code,
which reads `~/.claude/skills/`. The skill states where synced files are
(`~/Integrations/onedrive/`), which CLI to call, and that login problems go
to the browser's integration page, not the chat. MCP integrations add the
`mcp.json` entry with a `description`, which already announces them; their
skill is optional. Removing the integration removes both.

Rejected for this purpose: editing `~/.pi/agent/AGENTS.md` or
`APPEND_SYSTEM.md` (these are the person's own files; machine edits would
mix with theirs and every integration would cost prompt space in every
turn), and a generated system-prompt addition from the daemon (a second
source of truth beside the files the agent reads).

Not verified, for the prototype: whether Claude sessions through
pi-claude-bridge ([ADR 0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md))
see Pi's skills and MCP tools or only Claude Code's own `~/.claude/skills`
and `~/.claude.json`; and whether `pi mcp login` can be driven
non-interactively by the daemon with a pasted redirect.

## 4. Security under the Unix-user boundary

- **Tokens live in the native tool's own store in the person's home**:
  rclone `~/.config/rclone/rclone.conf`, abraunegg `~/.config/onedrive/`,
  `gog`/`gws` in their config dirs (file keyring, since there is no desktop
  keyring on the server), Pi MCP in `~/.pi/agent/mcp-auth.json`. Each file
  must be `0600` under a `0700` home, as the daemon unit's `UMask=0077`
  already ensures for what it creates. The daemon checks modes and refuses an
  integration whose store is group- or world-readable.
- **The daemon may**, as that user: run the native login and pass through
  the URL and the redirect; write the skill directory and the `mcp.json`
  entry; run status commands; start, stop and observe a sync it owns; remove
  what it created. It does this by name from a fixed catalog; the browser
  never supplies a command, path or config text.
- **The gateway may** relay an OAuth redirect to the person's daemon once,
  as it hands over the GitHub token today, and must not keep or log it.
- **Never across users**: a token, a synced directory, a log line with a
  token or file name, a sync process running as another user, or a shared
  cache directory. No root component reads or writes integration state. An
  operator-registered OAuth client may be shared; its tokens may not.
- **Agent exposure is the real risk.** Anything synced or fetched is
  readable by every agent the person runs, and a prompt-injected document can
  ask the agent to send mail or exfiltrate files with the person's
  authority. Pi says the same (`security.md`: transcript watching is not a
  boundary). Mitigations within our model: read-only scopes by default
  (Gmail read, Drive read, one-way sync), write scopes as a separate,
  explicit choice; and saying in the UI that agents can read and act on the
  data. Conversation history will contain fetched mail and file contents.
- **Background work needs a process.** The daemon is socket-activated
  (`systemd/open-habitat-daemon@.service`); nothing guarantees it runs when
  nobody is connected. Continuous sync therefore needs a new per-user unit
  (for example `open-habitat-sync@<user>` started as the user, or the user's
  systemd manager with lingering, which root must enable). Either is new host
  surface and therefore an architecture question.

## 5. Architecture options

**A. Install-only: skills and native tools, no product flow.** The operator
installs `rclone`, `onedrive`, `gog`/`gws` on the host; the person (or their
agent) runs logins from a terminal and copies skills by hand or with
`npx skills add`. Zero new code, perfect OpenClaw skill reuse. But a
browser-only person cannot complete loopback OAuth on a remote server,
nothing tells them what is connected, and agents asking for logins in chat
invites pasting secrets into history. Fine as the power-user path; not the
product Jari described.

**B. Catalog of native integrations driven by the daemon (recommended).**
A versioned catalog in the binary: per integration, the native tool, the
login flow kind (paste redirect, device code, MCP OAuth), scopes, status
command, skill text and, for sync, the target directory. The browser's
integration page lists catalog entries with status computed live from the
native tools (nothing stored about "what is connected"; the native config is
the truth). Adding one runs the native login as the user, writes the skill
to `~/.agents/skills/`, and the MCP entry to `~/.pi/agent/mcp.json` when
relevant. Fits both root rules, reuses OpenClaw skills as content (we can
start from `gog`, `notion`, `himalaya` and adjust), and keeps every token in
a native store. Costs: we own the login-flow glue per tool (fragile when a
CLI changes its prompts), an operator package list, and a sync process
decision. Remains open for arbitrary user-installed skills and MCP servers
alongside it.

**C. Run OpenClaw's gateway per user as the integration layer.** Start an
OpenClaw gateway as each Unix user and use its Control UI pages, plugins and
MCP management. It would bring the most features at once, including native
plugins and ClawHub. But it adds a second agent platform with its own
config, secret store, sessions and memory beside Pi, against "reuse native
components" and against "Pi owns conversations" (ADR 0016); its UI is an
administrator console; and it is a very large, fast-moving dependency
(57 000 files at the read commit). Rejected unless Jari wants OpenClaw's
chat channels as a product feature, which is a different decision.

**D. MCP only.** Every integration is an MCP server in `mcp.json` with Pi's
OAuth. Smallest code, uniform UI. But SharePoint/OneDrive "into the home
directory" is not possible this way, Google's servers are preview and
Workspace-only, Microsoft's need extra licences, and many OpenClaw skills are
CLI-based. Works as one flow kind inside B, not as the whole design.

## 6. Decisions for Jari

1. **Option B**, with MCP and CLI and sync as three flow kinds in one catalog?
2. **OAuth clients:** may the installation operator register one Google, one
   Microsoft (Entra, multi-tenant) and later one Slack app and configure their
   IDs host-wide, with tokens staying per user? The alternative is that each
   person brings their own client, which almost nobody will do.
3. **Background sync:** may we add a per-user sync process that runs without
   a browser connection, or should the first round sync only on demand (the
   agent or the person presses "sync now", like a clone job,
   [ADR 0024](../../docs/decisions/adr-0024-clone-jobs.md))? On-demand needs
   no new host surface and is my suggestion for the prototype.
4. **Default scopes read-only**, with write (send mail, two-way sync) as a
   later explicit step?

## Suggested prototype round

Notion via MCP (no client registration, proves the browser-carried OAuth and
the `mcp.json` + skill write), then Google (Gmail + Calendar through `gog` or
`gws`, Testing-mode client on the test server), then OneDrive/SharePoint as an
on-demand `rclone` or `onedrive --sync` job into `~/Integrations/`.

## Where evidence is thin

- Microsoft's official MCP offering and Google's MCP servers are recent and
  in preview; their terms and limits come from vendor docs and third-party
  summaries read on 2026-10-17 and may change.
- Sources disagree on whether `gws` has an MCP mode; its current README does
  not mention one.
- Pi-claude-bridge visibility of Pi skills/MCP and non-interactive
  `pi mcp login` are untested (section 3).
- Admin-consent policies in Microsoft tenants and Slack workspaces decide
  whether a given person can connect at all; we cannot test that with only
  Jari's accounts.

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
