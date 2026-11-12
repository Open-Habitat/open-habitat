# Result: agents search and fetch Microsoft 365 files

**The pilot release waits for Jari's proofreading of the agent text**
([agent-text.md](agent-text.md)). The code is on `main`, which feeds only the
disposable test server. The issue stays at `testing` until Jari has read the
text and a real account has been tried (KOKEILTAVAA).

On 12.11.2026 the whole personal-data text, not only the Microsoft
paragraph, was rewritten with `/rethink-instructions` for that proofreading;
`agent-text.md` carries it in full, with before and after renderings beside it.

## What agents get

A person's agent sees these file tools in the account's existing Pi MCP
server (`habitat-microsoft-…`), at every level whose grant includes files or
sites (all four levels do):

| Tool | What it does |
| --- | --- |
| `search-query` | Microsoft Search (`POST /search/query`, `driveItem`): names and contents across OneDrive, every SharePoint site and team (followed or not, communication sites included) and items shared with the person |
| `search-onedrive-files` | search within one drive |
| `search-sharepoint-sites`, `list-sharepoint-site-drives` | find a site and its libraries |
| `get-drive-root-item`, `list-folder-files`, `get-drive-item` | look at one folder or item |
| `download-bytes-to-file` (already offered), `get-download-url` | fetch one file |

No tool that uploads, moves, renames, copies, shares, deletes or previews a
file is offered at any level, and `graph-batch` is never offered. Tool names
are checked against the pinned **@softeria/ms-365-mcp-server 0.170.1**.

The generated personal-data skill tells the agent to search first, fetch
only what it needs into `~/cloud/microsoft-fetched/<account>/…`, grep only
within fetched files (or inside one ready sync directory), never recursively
over `~/cloud/`, and that edits stay local.

## What had to change beyond the brief

The research assumed adding the `files` and `search` presets would be
enough. In the pinned server it is not, and naively doing it would have
broken every Microsoft agent tool:

- The server requests exactly the scopes its tool metadata names. The file
  tools name `Files.Read`, which no Habitat application holds (they hold
  `Files.*.All`), and the SharePoint tools name `Sites.Read.All`, which the
  write levels do not hold. A token request naming an unconsented permission
  fails as a whole, so the Outlook tools would have stopped too.
- `search-query` names `Mail.Read Calendars.Read Files.Read.All People.Read
  Sites.Read.All Chat.Read ChannelMessage.Read.All` as one required set
  (still so in 0.184.0, the newest on 12.11.), so with `--allowed-scopes` it is
  never offered without Teams chat scopes.
- `--preset` replaces `--enabled-tools`, so presets cannot be combined with a
  read-only file subset; the write levels' `Files.ReadWrite.All` would offer
  every upload and delete tool.

So: the registration now uses `--org-mode --enabled-tools <explicit list>`
(the earlier presets' Outlook tools plus the file read tools) and the
profile build rewrites the scope metadata of exactly the seven file tools in
the pinned server's `endpoints.json`
(`runtime/profiles/integrations/ms-365-mcp-server-scopes.json`). The build
fails if any of those entries differs from the reviewed upstream bytes or
the version changes.

## Decisions for later review

1. **Patch the pinned server's scope metadata at build time** instead of
   asking every tenant to consent to more. Alternatives: (a) add `Files.Read`
   (and `Sites.Read.All` at write levels) to every level's Entra application,
   which grants nothing new but needs every organisation's administrator to
   consent again before files work, and still leaves `search-query` out;
   (b) add `Chat.Read`/`ChannelMessage.Read.All`/`People.Read` for
   `search-query`, which is the separate Teams-messages decision
   (`m365-teams-messages`) and was not taken here; (c) write our own Graph
   search/fetch tool, a new component racing the MCP server's token cache;
   (d) fix upstream and bump the pin, which is the right long-term route but
   publishes outside the repository (not done). The patch keeps authority
   where it was: the token can still do only what the tenant consented to the
   level's application, and the requested names are exactly those consented
   names. An upstream pull request that lists alternative permissions per tool
   (and per entity type for `search-query`) would let the patch go.
2. **Fetched files go to `~/cloud/microsoft-fetched/<account>/<host>/<path
   of the item's webUrl>`**, e.g.
   `…/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`;
   the drive ID and file name when the `webUrl` is not a plain path.
   Alternatives: drive and item IDs (unique but unreadable), or the sync
   layout `~/cloud/sharepoint/<organisation>/<site>/<library>/` (would mix
   fetched copies with live two-way sync and collide with a later sync of the
   same library). The `webUrl` path is readable, unique, available on every
   search hit, and names the cloud location for a later write-back. The agent
   creates the directory; the daemon does not, and account removal does not
   delete fetched copies (they are the person's working files now, not a
   sync mirror).
3. **Write-back is not offered.** An edited fetched file stays local; the
   agent tells the person where the copy is so they can upload it in
   OneDrive/SharePoint or Office, or work in a synced library. The later write
   tools should upload with the item's eTag (`If-Match`) so a version changed
   in the cloud since the fetch is not overwritten silently, and keep a
   conflict copy instead, as Jari's safety target asks (compare
   `research-cloud-write-safety`).
4. **Existing accounts are re-registered automatically.** A registration an
   earlier release wrote (with `--preset`) counts as misaligned; alignment
   asks the tenant for the current grant through the adapter's `verify` and
   registers with it. An outage is retried at the next check; a refused grant
   keeps the old Outlook scopes until the next sign-in. A registration that is
   also on an earlier tenant moves and gains the file scopes in one step; only
   if the rclone remotes already proved the tenant move and the adapter is
   unreachable at that moment does the move go ahead with the Outlook scopes
   (files then wait for the next sign-in), so a tenant move never waits on an
   outage. Alternative: require a new sign-in, which would have meant asking
   every pilot person to reconnect.
5. **Two read-only Outlook tools now appear**: `get-schedule` (free/busy, which
   organisation mode enables under the existing calendar scope) and
   `get-download-url` (scope-free; fails harmlessly without a files grant).
   Pinned-server test records this exact difference. Alternative: drop them
   from the list; not done, since both are reads within the existing level.
6. **The Outlook tool list is now explicit in Go** (`microsoftOutlookTools`),
   equal to what the pinned presets enabled. A version bump that changes the
   presets fails `TestMicrosoftMCPToolsPinnedServer` instead of widening the
   agent's tools silently.

## Review

Critical rigor, because the change decides what agents reach with the
person's Microsoft credentials: GPT-6 Astra as finder, Claude Fable 5.1 as a
focused verifier of the credential boundary. One confirmed defect, fixed
before merge: a registration both on an earlier tenant and from an earlier
release would have moved tenant with Outlook-only scopes and never gained
the file tools. The verifier found no path to a write tool, an unconsented
scope request, or a widening/looping re-registration; it noted that the
patch's group order (ReadWrite.All first) is load-bearing, which the
pinned-server test enforces and the build function now says. Four other
observations were dropped as pre-existing or already guarded.

## Verification

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`:
  pass (config per level, skill text, re-registration on ok/refused/outage).
- Real integrations profile built with `./scripts/build-profile-runtime.sh
  integrations` (arm64, Birch); `scripts/test-integrations-runtime.py` passes
  on it, including the new check that the archive carries the patched
  metadata.
- `TestMicrosoftMCPToolsPinnedServer` against that built runtime: at each of
  the four levels the real server offers all eight file tools and no write
  tool, requests only permissions the level's application holds, and keeps
  the earlier Outlook surface (plus the two reads above). Against the
  unpatched upstream metadata the same test fails (requests `Files.Read`,
  `Sites.Read.All` at write levels; `search-query` absent).
- `microsoft-native.test.mjs` in the built runtime: pass.
- `scripts/test-profile-runtime-build.py`: pass, including the patch's
  exactness and failure cases.
- Not verified: Microsoft's own answers (a real search, a real fetch, and
  Entra issuing a token for the new scope set). That is the KOKEILTAVAA step
  with a real account on the test server.
