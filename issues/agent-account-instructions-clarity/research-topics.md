# Microsoft tools as topic areas: research

## Saatesanat

Microsoftin työkalut voi jakaa aihealueisiin jo nykyisellä Pi:llä: jokainen
alue (Posti, Kalenteri, Yhteystiedot, Tiedostot, Postilaatikon ylläpito) on
oma palvelimensa, jolla on yhden rivin kuvaus. Agentti näkee alueet ensin ja
katsoo sitten yhden alueen työkalut. Kirjautuminen pysyy yhtenä, eikä
kenenkään tarvitse kirjautua uudelleen.

Pilotin virhe toistui: kun agentti haki "SharePoint-kansiota", hakutulosten
kärjessä oli postikansion poisto. Alueiden kanssa haku osui oikeisiin
työkaluihin, kun agentti haki yhden alueen sisältä. Ohjeessa pitää siis
sanoa, että ensin valitaan alue. Poistot ja lähetykset voivat kysyä lupaa
selaimessa: Habitat näyttää Pi:n kysymykset jo nyt, kokeilu toimi.

Hinta on muisti: jokainen alue on oma prosessinsa, noin 150 Mt jokaista
avointa keskustelua kohden. Suosittelen alueita nyt ja Pi:lle ehdotusta,
jolla yksi prosessi riittää kaikille alueille.

## What was measured

Everything below comes from the installed release on the test host: Pi
1.5.2, the pinned Microsoft MCP server 0.170.1, a synthetic account
`aino.virtanen@contoso.test` and dummy application IDs. Nothing was signed
in, and an experiment extension blocked every Microsoft call before it
reached the server, so no mailbox was touched. The live runs used a cheap
model (`openai-codex/gpt-6-luna`). The experiments named the area entries
`microsoft-<area>`; the design below shortens that to `ms-<area>`, which
changes nothing but the length. Scripts and raw logs are under
`/var/tmp/agent-keep/agent-account-instructions-clarity/`; the area mapping
is `topic-areas.py` beside this file.

## Findings

### 1. How Pi can express the areas

**One `mcp.json` entry is one process and one namespace.** Pi 1.5.2 has no
way to let one server connection appear as several namespaces. An area is
therefore its own entry, each starting `ms-365-mcp-server` with Habitat's
level arguments and `--enabled-tools` narrowed to the area's tools. The
narrowing belongs in the server argument, not in Pi's `toolExposure`: the
server then never offers the other tools at all, and a tool can sit in two
areas (`download-bytes-to-file` serves both mail attachments and files).
`pi mcp list` with the five entries connected all of them:
mail 29, calendar 27, contacts 9, files 10, mailbox admin 25 tools.

**The sign-in stays one.** Every entry names the same token cache
(`MS365_MCP_TOKEN_CACHE_PATH`). The server is built for that: its cache
plugin re-reads the file before every token access and writes it
atomically (`buildDiskCoherencyCachePlugin`, `writeFileAtomically`). Habitat's
status and level logic keeps reading the one cache it reads today.

**Sign-in tools are hidden per entry.** The pinned server adds `login`,
`logout`, `verify-login`, `list-accounts`, `select-account` and
`remove-account` to every process whatever `--enabled-tools` says. Each
area entry hides them with `toolExposure: {"logout": "hidden", …}`; `pi mcp
list` showed them `[hidden]` in all five.

**Cost: one process per area per conversation.** Pi starts every configured
server in every session. One server process measured 153 MB resident with
two tools and 185 MB with all of them. Today that is about 185 MB per
Microsoft account per open conversation; five areas make it about 750 MB.
The test host has 31 GB.

**Names: short, or the search breaks.** Pi names a tool
`mcp__<server>__<tool>` and hashes anything over 64 characters. Today's
address-based server name (`habitat-microsoft-aino-virtanen-contoso-test`)
already hashes 92 of the 100 tool names, for example
`…_contoso_test__list_1a45ca8a` for `list-folder-files`; an area suffix
would hash 98. A word in the tool name weighs three times its weight in the
description, so a hashed tool loses its strongest search signal. With
`ms-<area>` names no tool is hashed except one 47-character calendar tool.
The address goes into the entry's `description` instead. (Filed separately
as `microsoft-server-name-hashes-tool-names`, since it matters even without
areas.)

**What the agent sees.** Habitat leaves exposure at Pi's default,
`codemode`, so the agent sees no Microsoft tool until a script looks for
one. Pi lists each server with its description in the `mcp_servers`
system-prompt section. Rendered with Pi's own function, today's section is
one line carrying the first 250 characters of the server's generic Graph
instructions. With areas it becomes:

```text
MCP servers whose tools are not declared to you. Call the tools of `codemode` servers from codemode scripts.
- mcp__microsoft_calendar (codemode): Outlook calendar of aino.virtanen@contoso.test: events, free/busy, invitations and replies.
- mcp__microsoft_contacts (codemode): Outlook contacts of aino.virtanen@contoso.test: find, add and update people.
- mcp__microsoft_files (codemode): OneDrive and SharePoint files of aino.virtanen@contoso.test: search documents, browse drives and folders, download a file.
- mcp__microsoft_mail (codemode): Outlook mail of aino.virtanen@contoso.test: find, read and file messages and attachments, write drafts and replies, send.
- mcp__microsoft_mailbox_admin (codemode): Arranging the Outlook mailbox of aino.virtanen@contoso.test: create, rename or delete mail folders, calendars and contact folders; calendar sharing; Focused Inbox. Only when the person asks to arrange the mailbox.
```

`describeNamespace("microsoft-files")` returned the name, that description,
the server's instructions and the area's ten tool names, which is enough to
pick a tool without searching. `searchTools(query, {namespace})` searches one
area. (`tool_search`, used only with `deferred` exposure, has no namespace
parameter.)

### 2. The original failure, reproduced

**Ranking.** The table runs Pi's own ranker (`Bm25Ranker`,
`createToolSearchDocument`) over the server's real tool listing. Each cell
is the first hit, and whether `delete-mail-folder` is among the eight that
`searchTools()` returns.

| Query | Today | Areas, search across all | Areas, search in `files` |
|---|---|---|---|
| find file in SharePoint folder | `delete-mail-folder` first | `delete-mail-folder` first | `search-sharepoint-sites`, no |
| list folder files | `delete-mail-folder` first | `list-folder-files`, yes (3rd) | `list-folder-files`, no |
| sharepoint folder employment contract | `delete-mail-folder` first | `search-sharepoint-sites`, yes | `search-sharepoint-sites`, no |
| list folder | `delete-mail-folder` first | `delete-mail-folder` first | `list-folder-files`, no |
| search files | `search-query`, no | `search-onedrive-files`, no | `search-onedrive-files`, no |

"Today" uses the address-based name and the area columns short names; with
a short name today's single server puts a right tool first in two of the
four folder queries, and `delete-mail-folder` is among the eight in all four. The tool that deletes a mail
folder matches "folder" in its name and many times in its description,
which is why it keeps winning. **Areas alone do not fix this.** They fix it
when the search is limited to one area.

**Live runs.** Two tasks ("find my employment contract in the SharePoint
folder HR/Sopimukset", in Finnish, and "list the files in the SharePoint
folder Shared Documents/HR"), each three times, with four setups. Every
`searchTools()` query the agent wrote was replayed through Pi's ranker on
the same tool set to count what it was shown.

| Setup (6 runs each) | Scripts per run | `searchTools` queries | Limited to one area | Shown `delete-mail-folder` | Shown any `delete-…` | First Microsoft call |
|---|---|---|---|---|---|---|
| Today, no account text | 5.8 | 22 | 0 | 4 | 6 | a file tool 4, `list-accounts` 2 |
| Today, today's account text | 6.5 | 15 | 0 | 7 | 7 | `search-query` 5, none (gave up after 4 min) 1 |
| Areas, no account text | 3.8 | 10 | 2 | 0 | 3 | `search-sharepoint-sites` 6 |
| Areas, area instruction | 3.2 | 6 | 6 | 0 | 0 | `search-query` 3, `search-sharepoint-sites` 3 |

In a run with today's surface, the agent's very first script,
`searchTools("Microsoft SharePoint find files search folder")`, got
`delete-mail-folder` as its top result, under the hashed name
`…_contoso_test__dele_caf25ccf`. That is the pilot's situation. With areas and the one-paragraph
instruction, the agent went `describeNamespace("microsoft-files")` → a
search inside the files area → `search-query` in three scripts, and was
never shown a mailbox-admin tool. With areas but without the instruction,
the agent sometimes searched across all areas and was shown admin tools.
The instruction is what makes the areas work. Two of today's runs began
with `list-accounts`, one of the sign-in tools the areas hide. No run
called a delete tool, since every call was blocked and the agent stopped
there.

### 3. Confirmation for destructive calls

**Pi's `tool_call` hook can pause a call and ask.** Every MCP call,
including calls made inside codemode scripts, passes through extension
`tool_call` handlers. A handler can `await ctx.ui.confirm(title, message)`
and return `{block: true, reason}` on no. In Pi's RPC mode, which Habitat
uses, the dialog arrives as an `extension_ui_request` with method `confirm`,
and Habitat already shows such requests in the browser and returns the
answer (`answerQuestion` in `internal/daemon/conversation_linux.go`).
Tested: asked to delete a mail folder by id, the agent called
`delete-mail-folder` from a codemode script; the hook raised
`confirm` "mcp__microsoft_mailbox_admin__delete_mail_folder
{"mailFolderId":"…"}", the answer `false` blocked the call, and the agent
replied "The delete request was declined, so the folder was not deleted."

**Annotations cannot choose what to confirm.** The server marks 52 of its
53 writing tools `destructiveHint: true`, including `create-draft-email`
and `accept-calendar-event`. Habitat has to name the calls itself.

**The server's own gate is not a person's confirmation.** With
`MS365_MCP_REQUIRE_CONFIRM=true` the server refuses destructive calls
without `confirm: true`, but the model sets that argument. In the test above
it did so unasked.

**It is a guard against mistakes, not a boundary.** The extension runs
inside the person's own Pi, and the token cache is readable by the person's
processes, so an agent determined to delete could still reach Graph another
way. The level setting remains the only boundary, as today.

**What belongs to Pi.** Today the hook is a Habitat extension, loaded the
way Habitat already loads `host-context.mjs` and the process companion. A
declarative per-tool confirmation in `mcp.json` (say `toolConfirm:
{"delete-*": true}`) would let Habitat write the rule beside the area
instead of shipping code, and is Pi's to accept. A Habitat-side MCP proxy
was not pursued: it would be a new component standing between Pi and a
native server, which this project avoids.

### 4. Which tools fall in which area

`topic-areas.py` starts the pinned server once per level and area, exactly
as an area entry would, and fails unless the areas together offer exactly
what one server offers today, less the six sign-in tools.

| Area | Full | Everything but sending | Drafts | Read only | Confirm at Full |
|---|---|---|---|---|---|
| Posti (mail) | 29 | 24 | 24 | 13 | 7 |
| Kalenteri (calendar) | 27 | 27 | 12 | 12 | 4 |
| Yhteystiedot (contacts) | 9 | 9 | 5 | 5 | 1 |
| Tiedostot (files) | 10 | 10 | 10 | 10 | 0 |
| Postilaatikon ylläpito (mailbox admin) | 25 | 25 | 15 | 8 | 7 |
| Distinct tools | 94 | 89 | 60 | 42 | 19 |
| Today, one server | 100 | 95 | 66 | 48 | |

Today's counts include the six sign-in tools; six tools sit in two areas
(`download-bytes-to-file` in mail and files, and five folder and calendar
listings in mailbox admin beside their content area). The exact names are
`AREAS` in the script. "Confirm" is every `delete-…` and every call that
reaches another person at once: `send-…`, `reply-…`, `forward-…`,
`cancel-calendar-event`, and granting or changing calendar sharing.

## Recommended design

1. **Five area entries per Microsoft account**, `ms-mail`, `ms-calendar`,
   `ms-contacts`, `ms-files` and `ms-admin` (`ms2-…` for a second
   account), each the account's present command with `--enabled-tools`
   narrowed to its area and the same token cache. Each entry's
   `description` names the address and what the area is for; the admin
   description says it is for arranging the mailbox when the person asks.
   Each entry hides the six sign-in tools with `toolExposure`.
2. **The account section of the agent's text names the areas** and says to
   pick one first: `describeNamespace("ms-files")` lists its tools,
   `searchTools(query, {namespace: "ms-files"})` searches it, and a mail
   folder is not a file folder. This replaces the "reached through the Pi
   MCP server" sentence; the file-search paragraph stays.
3. **A Habitat `tool_call` hook asks the person** before the 19 calls named
   above, through the browser dialog that already exists, and blocks with a
   reason when there is no browser (`ctx.hasUI` false).
4. **The level keeps working as now.** The same `--allowed-scopes` per area;
   an area with no tools at a level is not registered.
5. **Ask Pi upstream for two things.** One server entry declaring several
   tool groups, each its own namespace with its own description, over one
   connection, which brings the cost back to one process per account. And
   declarative confirmation per tool in `mcp.json`. Until Pi has the first,
   the five processes are the price; Jari decides whether that is
   acceptable on the pilot hosts.

Rejected: areas through `toolExposure` alone on one entry (Pi has no
per-tool namespace, so it cannot express areas); relying on global search
with better descriptions (the namespace text weighs only half a match and
the admin tools still win on "folder"); a Habitat MCP proxy (a new
component between Pi and the server).
