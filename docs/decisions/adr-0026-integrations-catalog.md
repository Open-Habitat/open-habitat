# ADR 0026: Integrations are a catalog of native tools run by the person's daemon

**Status:** Accepted by Jari on 2026-10-18. His decisions of that day are
recorded in [agent-integrations](../../issues/agent-integrations/item.md#decisions)
and, for the account model, the personal-data skill and the directory layout,
in the [prototype round's result](../../issues/proto-integrations/result.md).

## Context

People want their agents to use data that lives elsewhere: files in Google
Drive, OneDrive, SharePoint and Dropbox, and mail, calendars and contacts in
Google, Microsoft 365 and ordinary IMAP and CalDAV/CardDAV accounts. Two
research rounds
([first](../../issues/research-integrations/report.md),
Microsoft and Claude (`issues/research-integrations-microsoft/report.md`))
and a [prototype round](../../issues/proto-integrations/result.md) that drove
each tool's login on this host found the following.

- OpenClaw's data integrations are Agent Skills that teach an agent to call an
  ordinary CLI which keeps its own login. Pi reads the same skill format from
  `~/.agents/skills/` and has its own MCP client configured in
  `~/.pi/agent/mcp.json`, which `pi mcp add`, `remove` and `list` manage.
  OpenClaw's plugins, secret store and gateway-wide MCP configuration assume
  one trusted operator for all users and do not fit
  ADR 0001.
- Every candidate tool keeps its tokens in its own store under the home:
  rclone's `rclone.conf`, the onedrive client's configuration directory,
  `gog`'s file keyring, ms-365-mcp-server's MSAL cache.
- Google and Microsoft mail and calendar cannot be reached without a
  registered OAuth application. Work tenants on Microsoft's default consent
  policy also block ordinary users from approving mail, calendar, Files and
  Sites access, so a tenant administrator has to approve the application once.
  Ordinary IMAP, SMTP, CalDAV and CardDAV accounts need no application; they
  take an app password.
- A headless server cannot open a browser for a login. A tool's login has to
  be carried to the person's browser either as a device code or as a
  redirected address the person pastes back.
- `gog` has a two-step login that exits between the steps and uses PKCE, so
  nothing listens for the redirect. `gws` listens on a loopback port without
  `state` or PKCE and accepted a forged code from another local process.
  rclone's login needs its own listener on a fixed loopback port. abraunegg's
  onedrive client and ms-365-mcp-server both accept a device code, and
  variables in `mcp.json`'s `env` reach the MCP server.
- Claude sessions run through pi-claude-bridge
  (ADR 0016),
  which receives Pi's skill list and Pi's tools, including Pi's MCP tools, and
  ignores Claude Code's own skills and MCP configuration. A local capture of
  the real request confirmed this.
- The per-user daemon stays up after the browser disconnects; it stops only
  when it is restarted or the machine reboots.

## Decision

### A catalog of native tools, driven by the person's daemon

The product ships a catalog. Each entry names one native tool (a sync client,
a CLI or an MCP server), the kind of login it uses, how its status is read,
and what the personal-data skill says about it. Entries are product code,
released with the host binary, because each needs login glue for its tool.
OpenClaw skills are reused as skill content where they fit.

The person's daemon does all integration work as that person: it runs the
tool's login, maintains the personal-data skill and any MCP entry, runs
continuous sync, reads status and removes what it created. The gateway only
carries the browser's requests, as it does for everything else, and never
holds a token. The only root-side change is the boot start below.

Nothing is stored about which integrations a person has. Whether an account
is connected is read from the tool itself: its credential and configuration
in the home and its status command. The daemon recognizes what it created by
fixed, catalog-owned names per account (an rclone remote, an onedrive
configuration directory, an MCP entry), so the tool's own files are the
record, and a person can still install other skills and MCP servers by hand
without the catalog interfering.

### What is connected: accounts, several per provider

The unit the person connects, signs in again and removes is a provider
account, such as "Google · name@example.com", with its services inside. A
provider may have several accounts: once one Google account is connected, the
page offers "Lisää toinen Google-tili", and the same for every provider.
Where the tools allow it, one consent covers all of an account's services.

The scope now is:

| Provider | Services | Tool | Login |
|---|---|---|---|
| Google | Gmail, Calendar, Contacts | `gog` | Pasted redirect (`gog`'s two-step login) |
| Google | Drive files, continuous two-way sync | rclone, given the account's `gog` token so one consent serves both | Same consent as above |
| Microsoft 365 work accounts of the organisation (single tenant) | OneDrive and SharePoint files, continuous sync | abraunegg/onedrive; rclone if onedrive's device login does not hold for SharePoint | Device code |
| Microsoft 365 work accounts of the organisation (single tenant) | Outlook mail, calendar, contacts | Softeria ms-365-mcp-server, pinned, with narrowed `--allowed-scopes` | Device code |
| Any mail provider (for example iki.fi, Nextcloud) | IMAP and SMTP mail, CalDAV calendars, CardDAV contacts | `himalaya` for mail; a CalDAV/CardDAV client chosen in implementation | App password |
| Dropbox | Files, continuous two-way sync | rclone | Pasted redirect |

`gog` is the Google tool rather than `gws`, because `gws`'s login accepts
codes from any local user. Later, and only when a person needs them:
Nextcloud and WebDAV files, sending messages to Slack, Mattermost or Teams,
and notifications to the person about long tasks, for example through
Telegram. Notion is out.

Access is read and write by default. Where a tool supports it, a read-only
choice may be offered per account later; it is not the default.

### One personal-data skill tells agents about the person's data

Agents do not need to know about "onedrive"; they need to know the person's
own data. The daemon therefore generates and maintains one skill,
`~/.agents/skills/personal-data/SKILL.md`, that maps the person's mail,
calendars, files and contacts across every connected account: which account
is which, which tool or directory reaches it, and the rules of working with
it, such as preparing mail as a draft before sending. Jari's own `workspace`
skill is the model. The daemon rewrites the skill whenever an account is
added or removed; it holds no tokens, and it is regenerated from what the
tools report rather than kept as a record of its own.

MCP servers stay one entry per server and account in the person's
`~/.pi/agent/mcp.json`, written and removed through `pi mcp add` and
`pi mcp remove`, so the rest of the file is left alone. Nothing is written
under `~/.claude/` and nothing is added to the person's `AGENTS.md` or
generated into the system prompt.

This one location reaches both Pi models and Claude models, because the
bridge passes Pi's skills and tools to Claude. The check that guards a
pi-claude-bridge upgrade keeps a probe of this. The decision is revisited if
Claude ever runs outside the bridge, for example through the separate Claude
Code harness ADR 0016 keeps as a fallback; skills would then need a second
location.

### Logins pass through the browser, the tokens stay with the tool

The daemon runs the tool's own login as the person and relays it to the
browser in one of three ways:

- **Device code** (Microsoft): the tool prints a Microsoft link and a short
  code. The browser shows both; the person signs in at Microsoft; the daemon
  waits for the tool to finish. Nothing comes back through our host.
- **Pasted redirect** (Google, Dropbox): the browser opens the provider's
  sign-in page, which ends on a loopback address that does not load. The
  person pastes that address into the integration page, and the daemon hands
  it to the waiting tool.
- **App password** (IMAP, SMTP, CalDAV, CardDAV): the person creates an app
  password at their provider and types it with the server details into the
  integration page; the daemon writes it into the tool's own configuration.

The token or password is written by the tool, or by the daemon into the
tool's own store, in the home. If a tool cannot accept a pasted redirect, the
daemon may complete the exchange itself as the person and write the result
straight into that tool's own configuration; it keeps no copy. Dropbox
through rclone is that case.

Two routes are excluded. A tool that listens on a TCP port per person for its
login or service is reachable by every local user, which breaks the Unix-user
boundary. A redirect through the gateway's public address would put
authorization codes through the gateway's authority; that would need its own
decision.

When a tenant blocks device code or requires administrator consent, the
integration page says so in plain words and shows the administrator consent
link, rather than a raw provider error.

### Files sync continuously as the person, under `~/cloud/`

File integrations sync two ways into an ordinary directory in the home, not a
FUSE mount. A real directory keeps files available to agents and ordinary
tools when the provider is unreachable, counts against the person's quota
(ADR 0012), and needs no setuid
`fusermount`, which the daemon's `NoNewPrivileges` service setting would block
anyway.

Synced data lives under `~/cloud/<service>/<account>/`, all lowercase, where
the account is the account's email address; SharePoint libraries are under
`~/cloud/sharepoint/<organisation>/<site>/<library>/`. `~/cloud/` is outside
`~/src`, so synced files do not appear as workspaces. Mail, calendars and
contacts have no directory. Before the first sync the page shows the chosen
folders' size against the free quota and refuses a selection that does not
fit.

The daemon starts each connected sync client when it starts, supervises it as
its own child process, restarts it with backoff if it fails, and stops it on
disconnect. Sync therefore runs whether or not a browser is open. A daemon
restart, such as a release upgrade, stops and restarts the sync clients with
it; the clients resume from their own state.

At boot, the broker already restores each committed user's daemon socket. It
also starts the daemon service of each committed user who has at least one
syncing integration, so sync resumes after a reboot without waiting for the
person to sign in. Other users' daemons stay socket-activated. The broker
learns this from the person's integration directory in the home: it checks
only whether that directory exists, without following links and without
reading what is in it, so the most a person can cause is the start of their
own daemon. This is the one change on the root side: the broker's allowed
systemd action widens from starting the user's socket to starting the same
user's daemon service. It adds no new account, identity or data the broker
can reach.

### The operator's role

The operator of an installation:

- registers the OAuth applications: a Google client, one public-client
  Microsoft Entra application with device code allowed that serves both file
  sync and mail, calendar and contacts, and a Dropbox app, each with the
  scopes the catalog entries need; generic mail accounts need none;
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

The operator never holds a person's token or password and has no product
command to read one.

### The agent-exposure warning

Connecting an account gives every agent the person runs access to that data
with the person's authority: agents can read synced files and mail, send
mail, change calendars and contacts, and delete files that then disappear
from the cloud too. A file or mail can contain instructions an agent follows.
The connect dialog says this plainly before the login starts, and the
integrations page repeats it beside the connected accounts. The warning
informs; it is not a permission system, and the product adds no gate between
agents and connected data.

## Consequences

- Login glue per tool is the main maintenance cost: it breaks when a CLI
  changes its prompts, which is one reason the operator pins versions.
- The personal-data skill is generated text agents rely on; when a tool's
  commands change, the skill's wording changes with the catalog entry.
- Only users with a syncing integration get a daemon started at boot; the
  others start on first connection as before.
- Synced data uses the person's quota. A full quota stops sync, and the page
  must show that.
- Deletion now propagates: an agent that deletes a synced file deletes it in
  the cloud. Each sync client's own deletion safeguards are configured by the
  catalog entry. Removing an account keeps its synced folder unless the
  person chooses to delete it too, and does not revoke the grant at the
  provider.
- Mail, calendar and contact results enter conversations and so Pi's history,
  like any other tool output.

## Alternatives considered

- **Install only**: the operator installs the tools and people log in from a
  terminal. Works for SSH users, not for a person who only has a browser on a
  remote server.
- **An OpenClaw gateway per person**: the most ready-made integrations, but a
  second agent platform beside Pi, against ADR 0016.
- **MCP only**: cannot put SharePoint or Drive files in the home and leaves
  most OpenClaw skills unused, so MCP is one kind of entry, not the design.
- **A skill per catalog entry**: tells agents about tools rather than about
  the person's data, and leaves an agent to work out which of several
  accounts is meant.
- **One service per row instead of accounts**: closest to the catalog, but a
  Google user signs in twice and the person thinks in accounts.
- **A host credential broker** holding everyone's tokens: a second store of
  truth and a target holding every person's access, against ADR 0001.

## Still open

The prototype drove each login up to the provider's token exchange with dummy
applications. These need a real account or tenant:

- completing each exchange, including whether `gog`'s refresh token serves
  Drive in rclone, and the daemon-completed exchange for Dropbox;
- whether abraunegg/onedrive's device login works for SharePoint libraries,
  and whether one Entra registration serves both onedrive and
  ms-365-mcp-server;
- real-tenant behaviour: rejection of user consent, the consent link, a
  blocked device-code flow;
- live status from `rclone about`, `onedrive --display-quota` and
  `--display-sync-status`, `gog auth list --check` and
  `ms-365-mcp-server --verify-login`;
- long-term token life: refresh-token expiry, re-consent after a password
  change or a Conditional Access sign-in frequency policy, and how the page
  asks the person to sign in again;
- how a person picks which SharePoint libraries or Drive folders to sync, and
  two-way conflict and mass-deletion behaviour under real agent use.
