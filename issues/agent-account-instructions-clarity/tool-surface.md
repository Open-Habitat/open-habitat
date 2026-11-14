# Proposed tool surface per account level

Proposal only; nothing here is built. Every count comes from starting the
pinned Microsoft server (`@softeria/ms-365-mcp-server` 0.170.1,
`runtime/profiles/integrations/package.json`) with the arguments
`microsoftMCPArgs` in `internal/daemon/integrations/microsoft_linux.go`
registers for each level and asking it for its tool list.
`tool-surface-check.py` in this directory repeats that and prints the tables
below; it needs no network and no sign-in.

## Recommendation

Give the agent one everyday tool list for a Microsoft account, the same at
every level: what works on the person's messages, events, contacts and files.
What rearranges the mailbox itself (mail folders, calendars, sharing, inbox
rules) and the server's own sign-in management are not offered. The level
keeps doing what it does today: the provider refuses what the level does not
allow, and the server hides the tools that would be refused.

| Level | Tools today | Proposed |
|---|---|---|
| Full | 100 | 55 |
| Everything but sending (`nosend`) | 95 | 54 |
| Drafts (`drafts`) | 66 | 41 |
| Read only (`read`) | 48 | 32 |

No new setting, no new choice for the person. The reasons and the
alternatives are below.

## What the agent is handed today

### Microsoft: 100 tools at the full level

Habitat registers 109 tool names (101 in `microsoftOutlookTools`, which is
upstream's mail, calendar and contacts presets taken whole, plus 8 in
`microsoftFileTools`). What the server then offers at the full level:

| Area | Tools | Of which change something |
|---|---|---|
| Mail | 37 | 23 |
| Calendar | 33 | 21 |
| Contacts | 13 | 8 |
| Files (find and read only) | 8 | 0 |
| Byte transfer (`download-bytes`, `download-bytes-to-file`, `get-upload-url`) | 3 | 1 |
| Sign-in management | 6 | 4 |
| **Total** | **100** | **57** |

"Change something" is the server's own marking of each tool (no
`readOnlyHint`), except for sign-in management, where the four are `login`,
`logout`, `select-account` and `remove-account`.

Five things in that list are worth knowing before choosing:

1. **Six tools manage the sign-in itself**: `login`, `logout`,
   `verify-login`, `list-accounts`, `select-account`, `remove-account`. The
   server registers them whenever it runs over stdio, outside the reach of the
   `--enabled-tools` filter (`server.js`: registered unless HTTP mode). An
   agent that calls `logout` or `remove-account` signs the person's account
   out of Outlook until they connect it again in Settings. Nobody listed them;
   they are simply there, at every level, read-only included.
2. **Fifteen registered names are offered at no level**, because they need
   Graph permissions no level's application has: the four mail rule tools,
   mailbox settings (2), Outlook categories (2), meeting rooms and places (5),
   `find-meeting-times` and `upload-attachment-from-file`. So the mail rules
   the issue text mentions are not in front of the agent today. They would
   appear by themselves the day a level's permissions grew, since their names
   are already on the list.
3. **Five tools send mail, and three of them are named like ordinary
   actions**: `reply-mail-message`, `reply-all-mail-message`,
   `forward-mail-message` send at once, as `send-mail` does. Only
   `send-draft-message` sends something the person could have read first. The
   agent's text spends its one sentence about mail on warning of this.
4. **`get-upload-url` cannot work here.** Its description says it requires
   `--enable-attachment-urls`, which the server's `--help` describes as HTTP
   mode only; Habitat runs the server over stdio.
5. **Upstream's descriptions point at tools that are not offered.**
   `create-calendar-event` tells the agent to find recipients with
   `list-users` and the time zone with `get-mailbox-settings`; the server's
   instructions mention `upload-file-content` and `create-upload-session`.
   None of the four is on Habitat's list. This is upstream's text, and the
   proposal does not change it; the agent's own text should not lean on it.

### How Pi puts these in front of the agent

Pi does not declare an MCP server's tools to the model by default (exposure
`codemode`, Pi's `docs/mcp.md`; Habitat registers with `pi mcp add` and sets
no exposure). The agent reaches them by searching: a keyword search over tool
names and descriptions returns the eight best matches. A tool's name in Pi is
`mcp__<server>__<tool>`, hashed when it passes 64 characters, which a readable
server name plus a tool name usually does.

That is the likely mechanism behind the observed mistake (the pilot's
conversation was not read for this proposal). An agent that wants to list the
files of a folder searches for "list folder", and `list-folder-files`,
`list-mail-folders`, `list-mail-child-folders`, `list-contact-folders` and
`delete-mail-folder` all match those words. The fewer near-namesakes there
are, the more often the first match is the right one. It also means the tool
definitions (572 kB of JSON at the full level; `create-calendar` alone is
36 kB) are not sent to the model with every request, so the size is a cost of
searching and describing tools and not of every turn.

Pi has two settings Habitat does not use: a per-tool exposure, where `hidden`
makes a tool unreachable, and a one-line server `description` that is shown in
the system prompt and used to rank tool search.

### The other integrations

| Account | How the agent reaches it | Tools | Who decides the list |
|---|---|---|---|
| Atlassian (Jira, Confluence) | Atlassian's hosted MCP server, through Pi | not countable without a signed-in connection | Atlassian; Habitat chooses only the scopes the sign-in asks for (read, or read and write) |
| Trello | Trello's hosted MCP server, through Pi | same | Trello; same |
| Google | the `gog` command line | 23 `gmail`, 27 `calendar`, 28 `drive` and 11 `contacts` subcommands, plus Sheets, Docs and Slides | gog; the skill gives the command prefix |
| Mail over IMAP | `himalaya` | a command line | the skill names the handful of commands needed |
| CalDAV, CardDAV | `curl` with the account's config file | none; raw protocol | the skill spells out the requests |
| Dropbox, Google Drive, earlier Microsoft syncs | ordinary files under `~/cloud/` | none | the file system |

Only the Microsoft server is a tool list that Habitat itself composes, so it
is the only one this proposal changes. For Atlassian and Trello the one lever
is Pi's per-tool `hidden`, and it should wait until a connected account's
list has been read (`pi mcp list`). For Google, gog has `--disable-commands`
and `--gmail-no-send`, but the agent types the command line itself, so they
would only be advice; the task list proposed in `agent-text.md` does that job.

## Ordinary work and administration

The line proposed: **the agent works with what is in the mailbox, not with
how the mailbox is arranged.** Messages, drafts, events, contacts and files
are things a person hands to an assistant every day. Folders, calendars,
sharing and sorting rules are set up a few times a year, by the person, in
Outlook.

Stays (55 at the full level):

| Group | Tools | Names |
|---|---|---|
| Files: find and read | 9 | `search-query`, `search-onedrive-files`, `search-sharepoint-sites`, `list-sharepoint-site-drives`, `get-drive-root-item`, `list-folder-files`, `get-drive-item`, `get-download-url`, `download-bytes-to-file` |
| Mail: read | 8 | `list-mail-messages`, `list-mail-folders`, `list-mail-child-folders`, `list-mail-folder-messages`, `get-mail-message`, `read-mail-text`, `list-mail-attachments`, `get-mail-attachment-content` |
| Mail: draft and organise | 9 | `create-draft-email`, `create-reply-draft`, `create-reply-all-draft`, `create-forward-draft`, `update-mail-message`, `move-mail-message`, `delete-mail-message`, `add-mail-attachment`, `delete-mail-attachment` |
| Mail: send | 1 | `send-draft-message` |
| Calendar: read | 10 | `list-calendars`, `list-calendar-events`, `get-calendar-event`, `get-calendar-view`, `list-specific-calendar-events`, `get-specific-calendar-event`, `get-specific-calendar-view`, `list-calendar-event-instances`, `get-schedule`, `list-supported-time-zones` |
| Calendar: events | 10 | `create-calendar-event`, `update-calendar-event`, `delete-calendar-event`, the same three for a named calendar (`…-specific-calendar-event`), `accept-calendar-event`, `decline-calendar-event`, `tentatively-accept-calendar-event`, `cancel-calendar-event` |
| Contacts: read | 5 | `list-outlook-contacts`, `get-outlook-contact`, `list-contact-folders`, `list-contact-folder-child-folders`, `list-contact-folder-contacts` |
| Contacts: write | 3 | `create-outlook-contact`, `update-outlook-contact`, `delete-outlook-contact` |

Goes (45 at the full level):

| Group | Tools | Names | Why nobody asks an agent for it |
|---|---|---|---|
| Sign-in management | 6 | `login`, `logout`, `verify-login`, `list-accounts`, `select-account`, `remove-account` | Connecting and removing an account is done in Settings → Integrations, which also keeps the files side in step |
| Mail folder structure | 4 | `create-mail-folder`, `create-mail-child-folder`, `update-mail-folder`, `delete-mail-folder` | Deleting a folder deletes its mail, irreversibly by the tool's own description; the tool the pilot's agent reached for |
| Focused Inbox rules | 4 | `list-`, `create-`, `update-`, `delete-focused-inbox-override` | A sorting preference set in Outlook |
| Calendar sharing | 4 | `list-`, `create-`, `update-`, `delete-my-calendar-permission` | Decides who else sees or edits the person's calendar |
| Calendars themselves | 3 | `create-calendar`, `update-calendar`, `delete-calendar` | Deleting one deletes its events |
| Contact folder structure | 5 | `create-`, `update-`, `delete-contact-folder`, `create-contact-child-folder`, `create-contact-in-folder` | As mail folders |
| One-step send | 4 | `send-mail`, `reply-mail-message`, `reply-all-mail-message`, `forward-mail-message` | Sending stays possible through a draft, see below |
| Sync deltas | 3 | `list-mail-folder-messages-delta`, `list-calendar-events-delta`, `list-calendar-view-delta` | Change feeds for a program that keeps a copy in step |
| Mailbox odds and ends | 4 | `get-mail-tips`, `get-mail-message-mime`, `list-supported-languages`, `copy-mail-message` | Rare, and each has a near-namesake among the tools that stay |
| Upload plumbing | 3 | `create-mail-attachment-upload-session`, `create-calendar-event-attachment-upload-session`, `get-upload-url` | The first two return a URL and leave the upload to the caller; the third cannot work over stdio |
| Base64 download | 1 | `download-bytes` | `download-bytes-to-file` fetches the same bytes to a file without passing them through the conversation |
| Calendar extras | 4 | `forward-calendar-event`, `snooze-calendar-event-reminder`, `dismiss-calendar-event-reminder`, `add-calendar-event-attachment` | Reminders belong to the person's own devices; the other two are rare |

The fifteen names that are offered at no level leave the list too, so that
widening a level's permissions later cannot bring mail rules or mailbox
settings in front of the agent without anyone deciding it.

**Sending through one tool.** With `send-draft-message` as the only tool that
sends, every message exists as a draft before it goes, at every level that
can send at all. The agent prepares a reply with `create-reply-draft` and,
when the person asked for it to be sent, sends that draft: two calls instead
of one. Nothing the person can ask for is lost. What goes away is the
possibility of sending by calling a tool named `reply-mail-message`.

## How the level setting maps to it

A level is a boundary Microsoft enforces: each level is its own Entra
application with its own consented permissions (`microsoftLevelScopes`), and
`--allowed-scopes` makes the server hide what the grant cannot run
(`microsoftAllowed`). That part is sound and stays untouched. The question is
only what the list is before the level filters it.

### Option A: leave it (today)

The list is upstream's presets. Nothing to build. The agent keeps 100 tools,
the sign-in tools and the four ways to send, and every upstream release that
adds a tool to a preset adds it for the agent after a look at the failing
test.

### Option B: one everyday list, the level filters it (recommended)

The list above replaces the presets; the level works as today.

| | Full | `nosend` | `drafts` | `read` |
|---|---|---|---|---|
| Files: find and read | 9 | 9 | 9 | 9 |
| Mail: read | 8 | 8 | 8 | 8 |
| Mail: draft and organise | 9 | 9 | 9 | 0 |
| Mail: send | 1 | 0 | 0 | 0 |
| Calendar: read | 10 | 10 | 10 | 10 |
| Calendar: events | 10 | 10 | 0 | 0 |
| Contacts: read | 5 | 5 | 5 | 5 |
| Contacts: write | 3 | 3 | 0 | 0 |
| **Total** | **55** | **54** | **41** | **32** |

- What a person loses: asking the agent to create, rename or delete a mail
  folder, calendar or contact folder, to share a calendar, to set a Focused
  Inbox rule, to attach a file to a calendar event, and to snooze a reminder.
  The likeliest one to be missed is "make a folder for these and move them
  there": the agent can move messages into any existing folder, but the person
  makes the folder.
- How they get it back: they do it in Outlook, once. If a pilot shows that
  one of these is asked for in practice, the name goes back on the list in a
  release; it is one line and one test. There is no per-person switch.
- This is not a security boundary and should not be described as one. The
  account's grant still permits these operations; the level is what the person
  can rely on. The list is about what the agent is led to, which is what went
  wrong.
- Existing accounts need no new sign-in. A registration whose arguments
  differ from the current ones is already detected (`mcpOutdated`) and written
  again by `Align` with the grant it has.

### Option C: everyday list plus a per-account "all tools" switch

As B, with a choice in Settings → Integrations that puts the administration
tools back for one account. It answers "how do I get it back" without a
release. It costs a new control and its texts in the interface, a contract
field, a place to remember the choice (the registered arguments could carry
it, so no new store), and a second surface to test on every server upgrade.
It also asks every person a question that, so far, no one has had a reason
to answer. Worth building when someone misses something, not before.

### Option D: tie the administration tools to the Full level

Full shows everything, the other levels the everyday list. No new setting,
but Full is the broadest level and the one a sign-in gets when none is named
(`firstLevel`), so most people would still hand their agent 100 tools, and the
level would start to mean two things at once: what Microsoft allows, and how
crowded the agent's toolbox is. Not recommended.

### Option E: let Pi hide tools instead of the server

Keep the presets and mark the unwanted tools `hidden` in the account's entry
in Pi's `mcp.json` (`toolExposure`). The result for the agent is the same as
B, and it is the only way to remove the six sign-in tools, since the server
registers them past its own filter. As the whole mechanism it is the weaker
choice: it is a deny list, so a tool that upstream adds is offered until
someone hides it, and the list would live in a file the person's own Pi also
edits (`/mcp` can change exposure). Used only for the sign-in tools, it is
six fixed names.

### Upstream's own switches, for completeness

- `--read-only`: offers 47 tools at the full level, the read level's 48
  without `get-upload-url`. It duplicates what the read level already does
  through permissions.
- `--preset`: what Habitat's list was copied from; coarse (all of mail, all of
  calendar).
- `--discovery` (experimental): replaces the tool list with three tools that
  search, describe and execute the rest. Pi already does this itself, so it
  would put one search behind another.
- `--enabled-tools`: a regular expression over tool names; what B uses, as
  today.

## Recommended, as a whole

1. Option B: `microsoftOutlookTools` becomes Habitat's own everyday list (47
   names, `download-bytes-to-file` among them, beside the 8 file tools).
2. The six sign-in tools are hidden through Pi's per-tool exposure when the
   server is registered. Under B they are then the only tools Habitat hides
   on Pi's side.
3. The server entry gets the one-line description proposed in
   `agent-text.md`.

Maintenance when upstream adds tools: an allow list means a new upstream tool
reaches no agent until someone adds it. To keep that from turning into never
looking, the existing test (`TestMicrosoftMCPToolsPinnedServer`) changes from
"the list equals upstream's presets" to "every preset tool is either on the
everyday list or on a second list of tools deliberately not offered". A server
upgrade that adds a tool then fails the test until the new name is put on one
of the two lists, which is the same one-line review as today, with the
decision written down. The two lists in `tool-surface-check.py` are that
classification for 0.170.1.

One follow-up this makes visible, not part of the recommendation: attaching a
file to a draft. `add-mail-attachment` takes the file as base64 in the tool
call and stops at 3 MB. The server has `upload-attachment-from-file`, which
reads the file from disk, but offers it only when `MS365_MCP_UPLOAD_DIRS`
names the directories it may read from, and Habitat sets none. Naming one
directory there would give the agent a workable way to attach what it made.
