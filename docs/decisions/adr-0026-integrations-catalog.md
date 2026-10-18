# ADR 0026: Integrations are a catalog of native tools run by the person's daemon

**Status:** Proposed, 2026-10-18. Jari has not yet accepted the catalog
design. His decisions of 18 October 2026 in
[agent-integrations](../../issues/agent-integrations/item.md#decisions) are
inputs, not open points: Google Drive and SharePoint first with their mail and
calendars, read and write by default, operator-registered OAuth applications
host-wide with each person's tokens their own, and continuous file sync as the
user.

## Context

People want their agents to use data that lives elsewhere: files in Google
Drive, OneDrive, SharePoint and Dropbox, and mail and calendars in Gmail and
Microsoft 365. Two research rounds
([first](../../issues/research-integrations/report.md),
[Microsoft and Claude](../../issues/research-integrations-microsoft/report.md))
found the following.

- OpenClaw's data integrations are Agent Skills that teach an agent to call an
  ordinary CLI which keeps its own login. Pi reads the same skill format from
  `~/.agents/skills/` and has its own MCP client configured in
  `~/.pi/agent/mcp.json`. OpenClaw's plugins, secret store and gateway-wide
  MCP configuration assume one trusted operator for all users and do not fit
  [ADR 0001](adr-0001-unix-native-agent-host.md).
- Every candidate tool keeps its tokens in its own store under the home:
  rclone's `rclone.conf`, the onedrive client's configuration directory,
  `gog`'s file keyring, ms-365-mcp-server's MSAL cache.
- Google and Microsoft mail and calendar cannot be reached without a
  registered OAuth application. Work tenants on Microsoft's default consent
  policy also block ordinary users from approving mail, calendar, Files and
  Sites access, so a tenant administrator has to approve the application once.
- A headless server cannot open a browser for a login. A tool's login has to
  be carried to the person's browser either as a device code or as a
  redirected address the person pastes back.
- Claude sessions run through pi-claude-bridge
  ([ADR 0016](adr-0016-native-harnesses-and-subscription-authorization.md)),
  which receives Pi's skill list and Pi's tools, including Pi's MCP tools, and
  ignores Claude Code's own skills and MCP configuration. A local capture of
  the real request confirmed this.
- The per-user daemon stays up after the browser disconnects; it stops only
  when it is restarted or the machine reboots.

## Decision

### A catalog of native tools, driven by the person's daemon

The product ships a catalog. Each entry names one native tool (a sync client,
a CLI or an MCP server), the kind of login it uses, how its status is read,
and the skill text that tells agents about it. Entries are product code,
released with the host binary, because each needs login glue for its tool.
OpenClaw skills are reused as skill content where they fit.

The person's daemon does all integration work as that person: it runs the
tool's login, writes the skill and any MCP entry, runs continuous sync, reads
status and removes what it created. The gateway only carries the browser's
requests, as it does for everything else, and never holds a token. No root
component touches integration state.

Nothing is stored about which integrations a person has. Whether an entry is
connected is read from the tool itself: its credential and configuration in
the home and its status command. The daemon recognizes what it created by
fixed names (a catalog-owned rclone remote, onedrive configuration directory,
skill directory or MCP entry), so the tool's own files are the record, and a
person can still install other skills and MCP servers by hand without the
catalog interfering.

The first entries follow Jari's priorities:

| Integration | Tool | Kind | Login |
|---|---|---|---|
| Google Drive | rclone, continuous two-way sync | File sync | Pasted redirect |
| Gmail and Google Calendar | `gog` or `gws` with a skill | CLI | Pasted redirect |
| SharePoint and OneDrive | abraunegg/onedrive, continuous sync; rclone if onedrive's device login does not hold | File sync | Device code |
| Outlook mail and calendar | Softeria ms-365-mcp-server, pinned, `--preset mail,calendar` with narrowed `--allowed-scopes` | MCP | Device code |
| Dropbox | rclone, continuous two-way sync | File sync | Pasted redirect |

Access is read and write by default. Where a tool supports it, a read-only
choice may be offered per entry later; it is not the default.

### Where skills and MCP entries are written

An entry's skill goes in `~/.agents/skills/<name>/SKILL.md` and its MCP server
in the person's `~/.pi/agent/mcp.json`, written by the daemon. The daemon
edits only its own named entry in `mcp.json` and keeps everything else in the
file. Nothing is written under `~/.claude/` and nothing is added to the
person's `AGENTS.md` or generated into the system prompt.

This one location reaches both Pi models and Claude models, because the
bridge passes Pi's skills and tools to Claude. The check that guards a
pi-claude-bridge upgrade keeps a probe of this. The decision is revisited if
Claude ever runs outside the bridge, for example through the separate Claude
Code harness ADR 0016 keeps as a fallback; skills would then need a second
location.

### Logins pass through the browser, the tokens stay with the tool

The daemon runs the tool's own login as the person and relays it to the
browser in one of two ways:

- **Device code** (Microsoft): the tool prints a Microsoft link and a short
  code. The browser shows both; the person signs in at Microsoft; the daemon
  waits for the tool to finish. Nothing comes back through our host.
- **Pasted redirect** (Google, Dropbox): the browser opens the provider's
  sign-in page, which ends on a loopback address that does not load. The
  person pastes that address into the integration page, and the daemon hands
  it to the waiting tool.

The token is written by the tool into its own store in the home. If a tool
cannot accept a pasted redirect, the daemon may complete the exchange itself
as the person and write the result straight into that tool's own
configuration; it keeps no copy.

Two routes are excluded. A tool that listens on a TCP port per person for its
login or service is reachable by every local user, which breaks the Unix-user
boundary. A redirect through the gateway's public address would put
authorization codes through the gateway's authority; that would need its own
decision.

When a tenant blocks device code or requires administrator consent, the
integration page says so in plain words and shows the administrator consent
link, rather than a raw provider error.

### Files sync continuously as the person

File integrations sync two ways into an ordinary directory in the home, not a
FUSE mount. A real directory keeps files available to agents and ordinary
tools when the provider is unreachable, counts against the person's quota
([ADR 0012](adr-0012-per-user-storage-quotas.md)), and needs no setuid
`fusermount`, which the daemon's `NoNewPrivileges` service setting would block
anyway.

The daemon starts each connected sync client when it starts, supervises it as
its own child process, restarts it with backoff if it fails, and stops it on
disconnect. Sync therefore runs whether or not a browser is open. A daemon
restart, such as a release upgrade, stops and restarts the sync clients with
it; the clients resume from their own state.

At boot, the broker already restores each committed user's daemon socket. It
also starts each committed user's daemon service, so sync resumes after a
reboot without waiting for the person to sign in. This is the one change on
the root side: the broker's allowed systemd action widens from starting the
user's socket to starting the same user's daemon service. It adds no new
account, identity or data the broker can reach.

### The operator's role

The operator of an installation:

- registers the OAuth applications: a Google client, one public-client
  Microsoft Entra application with device code allowed that serves both file
  sync and mail and calendar, and a Dropbox app, each with the scopes the
  catalog entries need;
- configures their client identifiers, and for Microsoft the tenant or
  audience, in one installation-wide integrations configuration that the
  daemon reads and validates at startup, like the Pi runtime selector.
  These identify the application, not a person; a Google installed-app
  client secret is not confidential by Google's own definition, so this file
  may be readable by every user;
- installs and pins the tools, so a person's daemon only runs operator-chosen
  versions; an entry whose tool or configuration is missing is shown as not
  available on this server;
- obtains tenant-wide administrator consent for work tenants, or hands the
  consent link to another organisation's administrator; for a company's own
  Google Workspace, marks the Google application internal, which avoids
  Google's verification and the 7-day token expiry of a Testing-mode app.

The operator never holds a person's token and has no product command to read
one.

### The agent-exposure warning

Connecting an integration gives every agent the person runs access to that
data with the person's authority: agents can read synced files and mail, send
mail, change calendars and delete files that then disappear from the cloud
too. A file or mail can contain instructions an agent follows. The connect
dialog says this plainly before the login starts, and the integrations page
repeats it beside the connected entries. The warning informs; it is not a
permission system, and the product adds no gate between agents and connected
data.

## Consequences

- Login glue per tool is the main maintenance cost: it breaks when a CLI
  changes its prompts, which is one reason the operator pins versions.
- Every person gets a running daemon after boot, whether or not they have
  integrations; the idle daemon is small.
- Synced data uses the person's quota. A full quota stops sync, and the page
  must show that.
- Deletion now propagates: an agent that deletes a synced file deletes it in
  the cloud. Each sync client's own deletion safeguards are configured by the
  catalog entry.
- Mail and calendar results enter conversations and so Pi's history, like any
  other tool output.

## Alternatives considered

- **Install only**: the operator installs the tools and people log in from a
  terminal. Works for SSH users, not for a person who only has a browser on a
  remote server.
- **An OpenClaw gateway per person**: the most ready-made integrations, but a
  second agent platform beside Pi, against ADR 0016.
- **MCP only**: cannot put SharePoint or Drive files in the home and leaves
  most OpenClaw skills unused, so MCP is one kind of entry, not the design.
- **A host credential broker** holding everyone's tokens: a second store of
  truth and a target holding every person's access, against ADR 0001.

## What only the prototype can settle

- Driving each login from the daemon end to end: parsing device-code output,
  accepting a pasted redirect for rclone, `gog` or `gws`, and completion,
  timeout and cancellation; whether any tool needs the daemon to finish the
  exchange itself.
- Whether abraunegg/onedrive's device login works for SharePoint libraries, or
  rclone is the Microsoft file tool; and whether one Entra registration really
  serves both the file client and ms-365-mcp-server.
- Real-tenant behaviour: rejection of user consent, the consent link, a
  blocked device-code flow. Jari's personal account exercises only the
  personal-account path.
- Whether `MS365_MCP_CLIENT_ID` and `MS365_MCP_TENANT_ID` in `mcp.json`'s
  `env` reach ms-365-mcp-server, and which MCP exposure (`codemode`,
  `deferred`, `direct`) serves agents best.
- `gog` versus `gws` for Gmail and Calendar.
- The directory layout of synced data in the home, how a person picks which
  SharePoint libraries or Drive folders to sync, and two-way conflict and
  mass-deletion behaviour under real agent use.
- Long-term token life: refresh-token expiry, re-consent after a password
  change or a Conditional Access sign-in frequency policy, and how the page
  asks the person to sign in again.
- Memory and start-up cost of starting every committed user's daemon at boot.
