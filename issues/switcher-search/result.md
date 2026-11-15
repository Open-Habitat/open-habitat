# ⌘K switcher with search across conversations: implemented (15.11.2026)

**Yhteenveto.** ⌘K Macilla ja Ctrl+K muualla (sekä `/` tekstikenttien
ulkopuolella ja sivupalkin ”Hae keskusteluista” -ovi) avaa kierroksen 3
listan *1 Keskustelut* tuotannossa. Rivi on keskustelu, ja sen sisällä on
paras osuva lause korostettuna. Nimiosumat ovat ylimpinä ja arkistoidut
viimeisinä. ”+N osumaa →” avaa muut osumat rivin alle ja ← sulkee. Enter
avaa keskustelun juuri näkyvän lauseen kohdalta: viesti on keskellä
rajattuna, sanat korostettuina, ja kentän yllä on hakunauha. Tyhjä haku
näyttää viimeksi avatut edellinen valittuna, joten ⌘K Enter vaihtaa kahden
välillä, ja ”Jatka hakua” palauttaa edellisen haun. Viestit haetaan
henkilön oman daemonin SQLite FTS5 -indeksistä (ADR 0036). Nimet löytyvät
selaimen snapshotista heti, myös indeksin vielä rakentuessa.

## What was built

- **ADR 0036** (`docs/decisions/adr-0036-conversation-search-index.md`):
  the per-person, derived, rebuildable index, its contents, incremental
  updates, Finnish matching, the route and the choice of `modernc.org/sqlite`.
- **Index** (`internal/searchindex`): FTS5 `trigram` over the person's and the
  agent's message text on the active branch (no tool output, tool calls,
  thinking or injected context), with conversation id, entry id, role and
  time. One file at `~/.local/state/open-habitat/search.sqlite`, created 0600
  in the verified 0700 state directory; an unknown schema version or an
  unreadable file is deleted and rebuilt. Sync is per session file by byte
  offset of the last complete line, leaf entry, size, mtime and inode: only
  appended lines are parsed; a shrunk, replaced or branched file is reindexed
  whole; an unterminated tail waits. The first build runs newest conversation
  first, one transaction each, and searches answer from what is indexed.
  Query words follow round 2's rule (two letters or more; five or more lose a
  Finnish case ending, final vowels and a doubled consonant: *kartan* →
  *kart*); every word must match; two-letter words use a LIKE scan.
- **Daemon route** `GET /api/v1/search?q=` (`internal/daemon/search_linux.go`),
  same peer check as history; a synced index answers without a stat of the
  session files for three seconds, then catches up (at most two seconds of
  waiting) before answering. **Gateway** relays it like a history read
  (`internal/gateway/search_linux.go`): GET only, one `q` of at most 200
  characters, session required.
- **Contract** `contracts/v1/search.schema.json` with two examples and
  negative checks (no title, cwd or full text, no tool roles, no bare ids, no
  empty hit lists, no path-like entry keys, no unknown index state).
- **Browser**: `components/Switcher.tsx` (the list, the band, the rail door),
  `app/SwitcherHost.tsx` (keys, debounced search, polling while the index
  builds, recent openings, choice), `app/switcherModel.ts` (stems, ranking,
  rows), `app/searchJump.tsx` (reads older pages until the hit is in the
  window, holds it in the middle through the view's own reading anchor,
  outlines it and marks the words with the CSS Custom Highlight API) wired
  into both the live conversation and the read-only history view.
  Explain-mode cards S34 (door) and S35 (results), a Storybook story, and the
  regenerated UI reference.

## Checks

- Go: `./internal/searchindex` (build, incremental append with an
  unterminated tail, branch, replace, removal, rebuild of an unknown file,
  ordering and hit bounds, Finnish terms, sentence cutting),
  `./internal/daemon` (whole package, including the route: building → ready,
  schema-valid reply, 0600 file, appended turn found, bad queries 400,
  untrusted peer 403), `./internal/gateway` (whole package, including the
  relay). `CGO_ENABLED=0` builds for linux/amd64 and linux/arm64.
- Contracts: focused contract checks clean, generated packages regenerated.
- Web: focused web checks (lint, typecheck, 222 unit files, catalogs, Finnish
  scan, catalog review); new unit tests for the model, the component's keys
  and the host (Ctrl+K/⌘K, `/` outside fields, terminal keeps Ctrl+K, names
  before the index, Enter sets the jump, empty query swaps, Continue search).
- Browser (`tests/switcher-search.spec.ts`, synthetic host with the real
  gateway and daemon, `OH_PORT_BASE=20500`): Ctrl+K, a name, the empty-query
  swap, *kartta* with the best sentence and +2, → and ←, Enter to a hit two
  pages back (centred, outlined, highlighted, band), close, Continue search,
  Esc, `/`, the empty result; the 390 sheet from the rail door; a hit in a
  browser-started conversation opening the live view with focus in the field.

## Live check

On the test server: press Ctrl+K (⌘K on a Mac) in any conversation, type a
word you remember from an older conversation, press → on a row with
”+N osumaa”, then Enter: the conversation opens at that message with a band
above the field. Press Ctrl+K again and Enter to swap back. On a phone, open
the menu and tap ”Hae keskusteluista”. The first search after the update
builds the index and says how far it is.

## Decisions for later review

- **Names are matched in the browser, not in the index.** The brief listed
  titles and workspaces among indexed fields. Alternative: index them too.
  The snapshot already carries the current display names (generated titles,
  renames, archive state), so names are found before the index exists and
  never go stale in it; an indexed copy would be a second place where a name
  could differ. The ADR records this.
- **`modernc.org/sqlite`** over `mattn/go-sqlite3` (needs cgo) and
  `ncruces/go-sqlite3` (WebAssembly runtime in every daemon). Cost: about
  6 MB binary per architecture and eight small BSD/MIT modules
  (`licenses/DEPENDENCIES.md`). `golang.org/x/sys` moved to v0.49.0 with it.
- **The jump reads older history pages until the hit is in the window**
  (at most 60 pages of 100 messages) instead of adding an "around this
  entry" history query. Alternative: a new history query. The existing pages
  keep the window's contiguity rules intact; a hit thousands of messages
  back costs a few seconds, said by the band ("Haetaan osumaa…").
- **Empty-query rows and name-only rows have no "latest message" line.** The
  prototype showed one muted; the snapshot carries no message text, and
  reading every recent conversation's tail for the list would be a history
  read per row. Rows show the workspace and when the conversation changed.
- **Recent openings are kept in the tab's memory**, then filled with the
  latest changed conversations. Alternative: session storage. A reload
  starts the list from the snapshot's order, as the rail does.
- **The index is built on the first search after a daemon start**, not at
  start. Alternative: build at daemon start. A person who never searches
  pays nothing; the first search says it is building and names are there.
- **Results stop at 50 conversations and 20 hits each**; `hit_count` is
  exact, so "+N osumaa" can exceed the rows an expansion shows.
- **No agent route for search.** Agents already read history through their
  own listener; a search command for them waits for a need.
- **A conversation the snapshot does not list is left out of the results**
  (it cannot be opened from the switcher).
- **One-letter words are not matched**, so "Arkistoitava 2" matches every
  "Arkistoitava N"; round 2's rule.
