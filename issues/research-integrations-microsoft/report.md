# Outlook mail and calendar, Dropbox, and what Claude sessions see

Second research round for [agent-integrations](../agent-integrations/item.md),
read on 2026-10-18. It continues the [first round](../research-integrations/report.md)
and Jari's decisions recorded in the epic: Google and Microsoft first with
their mail and calendars, read and write by default, the operator registers
the OAuth applications host-wide while each person's tokens stay theirs, and
file sync runs continuously as the user. The architecture decision is still
to be recorded as an ADR; this report ends with what it should say.

## The questions

1. Which tool gives an agent Microsoft 365 (Outlook) mail and calendar,
   reading and writing, on Linux; which permissions it asks for; how its
   login works when the person is in a browser and the tool runs on a
   headless server; where it keeps tokens; and whether a tenant
   administrator has to approve it.
2. How Dropbox fits as one more file-sync row.
3. Whether Claude sessions, which run through pi-claude-bridge
   ([ADR 0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md)),
   see the skills in `~/.agents/skills/` and the MCP servers in
   `~/.pi/agent/mcp.json`, or only Claude Code's own `~/.claude/skills`
   and MCP configuration. In other words, whether the catalog has to write
   everything in two places.

## Short answers

- **Microsoft mail and calendar:** Softeria's
  [ms-365-mcp-server](https://github.com/softeria/ms-365-mcp-server), an
  MIT-licensed MCP server, run as the user from `~/.pi/agent/mcp.json`
  with the operator's Entra application. Its login is Microsoft's device
  code: the browser shows a short code and a Microsoft link, and the person
  signs in there. It keeps its tokens encrypted in the person's home. The
  catch is consent. Since November 2025 Microsoft's default policy, which is
  also the default for new tenants, **no longer lets ordinary users approve
  mail or calendar access for an app**. A work tenant's administrator has to
  approve our application once for the whole tenant. Personal Outlook.com
  accounts do not have this problem.
- **Dropbox:** rclone with a Dropbox app the operator registers, for the
  same reasons as Google Drive. Dropbox's own Linux daemon also works
  headless and needs no registration, but it installs and updates itself in
  each home, and on a free account the server uses up one of the three
  devices the plan allows.
- **Claude sessions:** they see Pi's skills and Pi's MCP tools and **nothing
  from Claude Code's own `~/.claude` skills or MCP configuration**. I
  checked this locally by capturing the real request Claude Code sends to the
  API. The catalog writes in one place only: `~/.agents/skills/` and
  `~/.pi/agent/mcp.json`.

## 1. Microsoft 365 mail and calendar

### Why Graph and a registered application

Exchange Online no longer accepts passwords for IMAP, POP or SMTP. Mail can
only be reached with OAuth, either through Microsoft Graph or through IMAP
and SMTP with OAuth. Calendars are only available through Graph. Either way
someone has to register an Entra application, and Jari decided that the
operator does this.

### The options

| Option | What it is | Fits us? |
|---|---|---|
| **Softeria ms-365-mcp-server** | An MCP server over Graph, MIT licence, Node, very actively maintained (v0.170.1 on 2026-10-17, several releases a week). Mail: list, read, search, send, draft, reply, forward, move, delete, folders, rules, attachments. Calendar: list, read, create, update, delete, accept/decline, find meeting times. Works with work accounts (`--org-mode`) and personal ones. | **Recommended.** Stdio from Pi's `mcp.json` as the user, own client ID via environment, tokens in the home, write tools by default with `--read-only` available, and `--preset mail,calendar` plus `--allowed-scopes` to limit what it asks for. |
| **CLI for Microsoft 365 (`m365`, PnP)** | A broad Microsoft 365 administration CLI (MIT, Node, maintained by the PnP community). It has `outlook mail send`, `outlook message list/get/move/remove` and `outlook event list/get/add/remove`. Device code by default, browser login as an option, own app via `m365 setup` or `CLIMICROSOFT365_ENTRAAPPID`. Connection info in `~/.cli-m365-connection.json`. | A workable fallback as a skill plus a CLI, but it is built for administrators. Its mail commands are a small part of a large tool, with no drafts or replies in the list above. |
| **Microsoft's own Outlook MCP (Work IQ Mail and Calendar, Agent 365)** | Official, hosted by Microsoft. In preview, requires a Microsoft 365 Copilot licence, and an administrator has to set it up in Entra. Personal accounts are not supported. | No, as the default. It could be added later as an HTTP entry in `mcp.json` for organisations that already pay for Copilot. |
| **Himalaya (or another IMAP client) with OAuth** | Mail over IMAP/SMTP with an OAuth token. | Mail only, no calendar. The permissions it needs (`IMAP.AccessAsUser.All`) are blocked in the same way, so it gains nothing over Graph. |
| Microsoft Graph CLI (`mgc`) | Microsoft's generic Graph CLI. | No. Microsoft retired it on 2026-08-28. |

Softeria ships its own shared client ID (`084a3e9f-…`) as a default. We
should not rely on it: in a work tenant it is just as much an unverified
third-party app needing administrator approval, and it does not match
Jari's decision that the operator's registration is the identity.

### Permissions (delegated scopes)

I ran the pinned v0.170.1 locally with `--list-permissions --org-mode
--preset mail,calendar`. It asks for `Mail.ReadWrite`, `Mail.Send`,
`Calendars.ReadWrite`, `Calendars.Read.Shared`, `MailboxSettings.Read`,
`MailboxSettings.ReadWrite`, `Place.Read.All`, `Place.ReadWrite.All` and
`User.Read`. MSAL adds `offline_access`, `openid` and `profile` itself, so
the login lasts. The `Place.*` scopes are for meeting rooms, and
`Place.Read.All` always needs an administrator. A sensible catalog entry
narrows the request with `--allowed-scopes "Mail.ReadWrite Mail.Send
Calendars.ReadWrite MailboxSettings.Read User.Read"`; the server then hides
the 11 tools those scopes cannot serve (rooms, shared calendars, mailbox
settings changes). Shared mailboxes need the `*.Shared` scopes as well and
can be added later. The operator's Entra registration lists the same
delegated permissions, is a public client (no secret), and allows device
code ("Allow public client flows").

### Login on a headless server

Softeria offers two ways to log in when it runs as a local process:

- **Device code** (default). I ran `--login` locally; it prints one line,
  `To sign in, use a web browser to open the page https://login.microsoft.com/device
  and enter the code XXXXXXXX to authenticate.`, and waits. The daemon can
  run this as the user, show the link and code in the browser, and wait for
  the process to exit. Nothing has to be passed back to the server, which is
  why this suits a browser-only person best. The same flow is also exposed
  as the server's `login` and `verify-login` MCP tools, so an agent could
  show the code inside the conversation.
- **Browser with a loopback redirect** (`--auth-browser`). This opens a
  browser on the server and listens on `localhost`. On a headless server
  there is no browser, and Softeria cannot take the redirected URL pasted
  back, unlike rclone or Pi's own MCP login. It does not work for us.

The weak point is that **many tenants block device code**. Since 2025
Microsoft has rolled out a Microsoft-managed Conditional Access policy,
"Block device code flow", to tenants that have not used the flow, and it
recommends blocking the flow everywhere because of device-code phishing.
In such a tenant the sign-in fails until the administrator makes an
exception. The fallback routes are all heavier:

- Softeria's HTTP mode, where the server acts as an OAuth endpoint and Pi's
  MCP client does the sign-in with a paste-back. That means a listening
  network port per person, and any local user can reach a TCP port on
  `localhost`. Under our boundary that is a defect unless the port is
  replaced by a Unix socket, which neither side supports today.
- A redirect through the gateway's public address. This is architecture: the
  gateway would carry the code even if PKCE keeps it useless on its own.
  This would need its own decision with Jari.

For the prototype, device code is the route, and "device code is blocked in
this tenant" is an error the integration page has to explain in plain words.

### Where tokens live

Under the person's home: an MSAL token cache in
`~/.config/ms-365-mcp-server/` (or `$XDG_CONFIG_HOME`), encrypted with
AES-256-GCM. The key goes to the OS keyring when one exists. On a headless
server (our case; the local run logged "keytar not available, using
file-based credential storage") it goes in a `.cache-key` file with mode
0600 beside the cache. So the encryption protects only against copying the
cache without its key file. The real protection is the Unix permission on
the home, which is the boundary we already rely on. Logs, including an
`audit.log` of tool calls, go to `~/.ms-365-mcp-server/logs/`. The paths
can be moved with `MS365_MCP_TOKEN_CACHE_PATH` and
`MS365_MCP_SELECTED_ACCOUNT_PATH`. Nothing is stored outside the home.

### Admin consent in typical tenants

This changed recently, and it matters more than the tool choice.

- **Work and school tenants on Microsoft's default policy.** The setting
  "Let Microsoft manage your consent settings" is the default for new
  tenants, and older tenants on the legacy default were migrated to it.
  Under it, users cannot consent to `Mail.Read`, `Mail.ReadWrite`,
  `Calendars.Read`, `Calendars.ReadWrite`, `MailboxSettings.*`,
  `Files.Read(Write).All`, `Sites.Read(Write).All`, contacts, tasks,
  `IMAP.AccessAsUser.All` and others (36 in all, per Microsoft's
  documentation). Files and Sites were blocked in August 2025, and mail and
  calendar in November 2025. `Mail.Send` and `offline_access` are not
  blocked. The only exceptions are a fixed list of known mail apps (Apple
  Mail, Thunderbird, eM Client and a few others). Pretending to be one of
  them would be impersonation, and we will not do it.
- **What this means.** In a typical work tenant, someone with an
  administrator role grants tenant-wide admin consent to the operator's
  application once. After that, each person signs in normally, and their
  tokens are still theirs. If the operator's own organisation owns the
  tenant, the operator registers the app there and grants consent in the
  same visit. For other organisations' people, the operator gives their
  administrator a consent link (abraunegg's onedrive client has
  `--display-admin-consent-url` for exactly this). Tenants that have turned
  user consent off entirely need the same step anyway.
- **This also affects SharePoint and OneDrive files.** The first report
  said abraunegg/onedrive and rclone bring their own application identity,
  so files need no registration. In work tenants on the default policy that
  is no longer enough: their `Files.ReadWrite.All` and
  `Sites.ReadWrite.All` need administrator approval too, whether for their
  built-in app or ours. Practically, the operator's one Entra registration
  should cover both the file sync and mail/calendar, so that the
  administrator approves one application once.
- **Personal Microsoft accounts (Outlook.com, Hotmail).** No tenant
  administrator. The person consents for themselves. The registration's
  audience has to include personal accounts, and Softeria runs without
  `--org-mode` with tenant `consumers`, or `common`.

## 2. Dropbox

| Option | App identity | Login on a headless server | Sync into the home | Notes |
|---|---|---|---|---|
| **rclone** (recommended) | Built-in shared key works, but rclone recommends your own because of rate limits. The operator registers a Dropbox app with `account_info.read`, `files.metadata.write`, `files.content.read`, `files.content.write` and `sharing.write`. | Manual authorisation: the person opens the link and passes the code back, as for Google. | `rclone bisync` or a mount under the home, run continuously by the daemon. | One tool and one login model for Google Drive, Dropbox and, if wanted, OneDrive. Tokens live in the person's `rclone.conf`. |
| Dropbox's Linux daemon (`dropboxd`) | Dropbox's own; no registration. | On first start it prints a `https://www.dropbox.com/cli_link_nonce?nonce=…` link. The person opens it in the browser and the daemon links itself, with no paste-back. | Full two-way sync into `~/Dropbox`, with `dropbox exclude` for selective sync. | Installs into `~/.dropbox-dist` and updates itself there, outside the operator's package control. Needs ext4, xfs, btrfs or zfs. On Dropbox Basic (free) the server counts as one of the three devices allowed. Closed source. |

rclone is the better default because it matches the Google Drive route and
keeps the binary under the operator's package list. The Dropbox daemon
logs in more easily and is a reasonable second catalog entry for people who
want Dropbox's own behaviour. Whether rclone's API access counts toward the
three-device limit was not verified; as far as I know API apps do not count.

## 3. What a Claude session sees

### From the source

pi-claude-bridge 0.9.3 (the version the test server pins) runs Claude Code
through the Agent SDK as a **model provider**: Pi stays the agent and Claude
Code acts only as the model. In `src/index.ts` the provider query starts
Claude Code with:

- `tools: []`, so none of Claude Code's own tools are present, including
  its `Skill` tool and the skill list that comes with it;
- `--strict-mcp-config`, so Claude Code ignores MCP servers from
  `~/.claude.json` and `.mcp.json`, and `ENABLE_CLAUDEAI_MCP_SERVERS=0`, so
  it ignores the claude.ai-connected ones;
- `claudeMdExcludes` for every `CLAUDE.md`, `AGENTS.md` and
  `.claude/rules/**`, so Claude Code's own context files are dropped too;
- one in-process MCP server, `custom-tools`, which serves **the tools Pi has
  active in that session**, whatever their source: Pi's built-ins, tools
  from Pi extensions, and Pi's MCP tools as Pi exposes them;
- an appended system prompt built from what Pi loaded: Pi's context files
  and **Pi's skill list** (from `formatSkillsForPrompt`), rewritten so that
  Claude reads a skill file through Pi's `read` tool.

The comments in the bridge source say this is deliberate: "Pi owns
context-file discovery", and Claude Code's MCP servers are "pure token
overhead" because Pi executes the tools.

### Checked locally

In a disposable home under `/var/tmp/oh-skillvis` I placed one skill in
`~/.agents/skills/`, one in `~/.claude/skills/`, a small stdio MCP server
in `~/.pi/agent/mcp.json`, and a different MCP server in `~/.claude.json`.
I ran Pi 1.3.0 in print mode with pi-claude-bridge 0.9.3 and the bundled
Claude Code (Agent SDK 0.3.301), with `ANTHROPIC_BASE_URL` pointed at a
local capture server, so the real request Claude Code would send to
Anthropic was recorded and no account was used.

| What | Native Claude Code (baseline) | Claude through the bridge |
|---|---|---|
| Skill in `~/.agents/skills/` | — | **In the system prompt** |
| Skill in `~/.claude/skills/` | Listed | **Absent**, and no `Skill` tool |
| MCP server in `~/.pi/agent/mcp.json`, default `codemode` exposure | — | **Reachable** through Pi's `codemode` tool, and the server's `description` is listed in the system prompt |
| Same server with `exposure: direct` | — | **Declared directly** as `mcp__probemail__probe_mail_search` |
| MCP server in `~/.claude.json` | (configured) | **Absent** |

Tools Claude received: `read`, `bash`, `edit`, `write`, `codemode`, all
served through the bridge's `custom-tools` server. The daemon starts Pi with
`--mode rpc` and no `--no-skills` or `--no-extensions`
(`internal/daemon/pi_rpc_linux.go`), so the same holds in the browser.

So: **the catalog writes skills only to `~/.agents/skills/` and MCP entries
only to `~/.pi/agent/mcp.json`**, and both Pi models and Claude models see
them. Writing to `~/.claude/` would have no effect on browser sessions. It
would only matter to someone who also runs the `claude` CLI directly over
SSH, which is not our product. The bridge's older `AskClaude` tool, which is
being deprecated, behaves the same way (`skills: []` plus Pi's skill list).

Two caveats. This rests on the bridge's provider design. If a later bridge
version, or a fallback to a separate Claude Code harness (ADR 0016), let
Claude Code load its own configuration, skills would need a second location
or a symlink. The pinned upgrade should keep this probe as a check. Also,
Claude sees Pi's MCP tools exactly as Pi exposes them, so the `exposure`
the catalog chooses (`codemode`, `deferred` or `direct`) applies to both
model families alike.

## Recommendation

Keep the daemon-driven catalog from the first round, with these entries and
rules for Microsoft and Dropbox:

- **Microsoft mail and calendar** as an MCP entry: Softeria
  ms-365-mcp-server, pinned by the operator (it releases several times a
  week, so updates are deliberate). It runs from the person's
  `~/.pi/agent/mcp.json` with the operator's client ID and tenant in `env`,
  `--org-mode` for work accounts, `--preset mail,calendar` and a narrowed
  `--allowed-scopes`. Login is device code, run by the daemon as the user,
  with the code shown in the browser.
- **One Entra registration covers all of Microsoft**: SharePoint and OneDrive
  sync plus mail and calendar, with the delegated scopes listed above. For
  work tenants, the integration page shows the administrator consent link
  and a plain explanation when consent or device code is blocked.
- **Dropbox** through rclone with an operator-registered Dropbox app, the
  same flow kind as Google Drive. Dropbox's own daemon is optional.
- **Skills and MCP in one place**: `~/.agents/skills/<name>/` and
  `~/.pi/agent/mcp.json`, nothing under `~/.claude/`.

The alternative for Microsoft is the CLI for Microsoft 365 plus a skill. It
covers less mail functionality and adds a large administrator tool, so I
would use it only if Softeria's churn turns out to break things.

## What the ADR should say

**Microsoft mail and calendar.** Outlook mail and calendar go through
Microsoft Graph with delegated permissions, using a pinned
ms-365-mcp-server run as the person from their own `mcp.json`. The operator
registers one public-client Entra application (device code enabled, audience
covering work and personal accounts if both are wanted) that also serves
SharePoint and OneDrive sync. Sign-in is device code shown in the browser.
Tokens stay in the person's home. The host never sees them, and no
component outside the person's daemon touches them. Work tenants on
Microsoft's default consent policy need a one-time tenant-wide admin
consent for this application before anyone in them can connect mail,
calendar or SharePoint, and the product says so rather than hiding it.
Routes that need a listening port per person, or a redirect through the
gateway, are not part of this decision.

**Skill placement.** An integration's skill goes in `~/.agents/skills/` and
its MCP server in `~/.pi/agent/mcp.json`, written by the person's daemon.
This one location reaches Pi models and Claude models through
pi-claude-bridge, which deliberately ignores Claude Code's own skills, MCP
configuration and context files. The bridge-upgrade check keeps a probe of
this, and the decision is revisited if Claude ever runs outside the bridge.

## Testable only in the prototype

- **Driving the device-code login from the daemon** end to end: parsing the
  printed line, showing it in the browser, detecting completion, timeout and
  cancellation, and what happens when a tenant blocks device code.
- **Real-tenant admin consent**: whether a tenant on Microsoft's default
  policy rejects user consent for our application as documented, how the
  consent link and error page read, and whether one registration really
  covers onedrive or rclone plus Softeria. Jari's personal account
  exercises only the personal-account path. A test tenant (for example a
  Microsoft 365 developer tenant, if one is available) would show the work
  path.
- **Softeria's configuration through Pi's `mcp.json` `env`**: its README
  says some variables are read from `.env`. Whether `MS365_MCP_CLIENT_ID`
  and `MS365_MCP_TENANT_ID` set in `mcp.json` reach it was not tested.
- **Long-term token life**: refresh-token expiry and re-consent prompts
  after a password change or a Conditional Access sign-in frequency policy.
- **Dropbox daemon** on the test server's filesystem and quota setup
  ([ADR 0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md)),
  and whether rclone counts as a device on a free account.

## Not verified, and where evidence is thin

- Softeria's token-cache location and encryption come from its README and
  the startup log line. No real sign-in was completed, so the cache file
  itself was not seen.
- The consent-policy facts come from Microsoft's documentation (updated
  2026-08-28) and two administrator blogs. How many existing tenants still
  run custom or legacy settings is unknown, so "typical" means "default".
- How widely the Microsoft-managed "Block device code flow" policy is turned
  on comes from administrator blogs and Microsoft Q&A, not from a Microsoft
  statistic.
- The Claude visibility check used print mode and a capture server, not a
  browser session with a real subscription. The code path is the same
  provider path the daemon uses.

## Sources

- Softeria: [ms-365-mcp-server README](https://github.com/Softeria/ms-365-mcp-server/blob/main/README.md),
  [releases](https://github.com/Softeria/ms-365-mcp-server/releases),
  [`src/auth.ts`](https://github.com/Softeria/ms-365-mcp-server/blob/main/src/auth.ts),
  [`src/cloud-config.ts`](https://github.com/Softeria/ms-365-mcp-server/blob/main/src/cloud-config.ts),
  [issue #308 (device code expiring)](https://github.com/Softeria/ms-365-mcp-server/issues/308);
  local runs of `@softeria/ms-365-mcp-server@0.170.1` (`--help`,
  `--list-presets`, `--list-permissions`, `--login`) in `/var/tmp/oh-ms365`.
- CLI for Microsoft 365: [connecting](https://pnp.github.io/cli-microsoft365/user-guide/connecting-microsoft-365/),
  [own Entra identity](https://pnp.github.io/cli-microsoft365/user-guide/using-own-identity/),
  [outlook message list](https://pnp.github.io/cli-microsoft365/cmd/outlook/message/message-list/),
  [outlook mail send](https://pnp.github.io/cli-microsoft365/cmd/outlook/mail/mail-send/),
  [`src/auth/FileTokenStorage.ts`](https://github.com/pnp/cli-microsoft365/blob/main/src/auth/FileTokenStorage.ts).
- Microsoft: [Manage app consent policies](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies),
  [Configure user consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent),
  [Block authentication flows with Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-authentication-flows),
  [Device code flow](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-acquire-token-device-code-flow),
  [Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference),
  [Graph CLI deprecation (msgraph-cli #585)](https://github.com/microsoftgraph/msgraph-cli/issues/585).
- Consent-policy rollout: [topedia: 20 additional permissions blocked](https://blog.topedia.com/2025/11/microsoft-managed-default-app-consent-policy-now-blocks-20-additional-permissions/),
  [office365itpros: app consent policy](https://office365itpros.com/2025/06/19/app-consent-policy-user-app-consent/),
  [Sentrium: blocking device code flow](https://www.sentrium.co.uk/labs/blocking-device-code-flow-in-microsoft-entra-id).
- Microsoft official Outlook MCP: [Scalekit: Outlook MCP vs API](https://www.scalekit.com/blog/outlook-mcp-vs-api),
  [Outlook MCP: official, but gated behind Copilot](https://www.usecarly.com/blog/outlook-mcp/),
  [Agent 365 MCP servers in Copilot Studio](https://microsoft.github.io/mcscatblog/posts/a365-mcp-servers-copilot-studio/).
- abraunegg/onedrive: [usage](https://github.com/abraunegg/onedrive/blob/master/docs/usage.md),
  [discussion #2745 on admin approval](https://github.com/abraunegg/onedrive/discussions/2745).
- Dropbox: [rclone Dropbox](https://rclone.org/dropbox/),
  [Linux commands](https://help.dropbox.com/installs/linux-commands),
  [system requirements](https://help.dropbox.com/installs/system-requirements),
  [device limit](https://help.dropbox.com/account-access/computer-limit),
  [TechRepublic: Dropbox on a headless server](https://www.techrepublic.com/article/how-to-install-and-run-dropbox-from-a-headless-linux-server/).
- pi-claude-bridge 0.9.3 as installed in `/var/tmp/claude-bridge-study/runtime`:
  `src/index.ts` (provider query options, `CLAUDE_MD_EXCLUDES`,
  `CC_CHILD_ENV`, `resolveMcpTools`, `buildMcpServers`), `src/skills.ts`,
  `src/mcp-server.ts`, `src/agents-md.ts`, `src/config.ts`; upstream
  [repository](https://github.com/elidickinson/pi-claude-bridge).
- Pi 1.3.0 installed documentation: `docs/mcp.md` (configuration, exposure,
  OAuth), `docs/skills.md`.
- Open Habitat: [ADR 0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md),
  [ADR 0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md),
  `internal/daemon/pi_rpc_linux.go`, the
  [first research round](../research-integrations/report.md).
