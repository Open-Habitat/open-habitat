# Haku kaikkiin keskusteluihin – kierros 2

- **1 Lista**: ⌘K / Ctrl+K avaa kapean listan. Nimet ensin, alla viestit, joissa sana esiintyy, osuva lause korostettuna (enintään kaksi keskustelua kohden ja sitten määrä). Ei suodattimia. Enter avaa keskustelun osuneen viestin kohdalta.
- **2 Esikatselu**: sama haku leveänä ikkunana. Osumat ryhmitellään keskusteluittain, ja kentän alla on suodatinsirut: kuka sanoi, työtila, aika, arkistoidut ja työkalujen tulosteet. Oikealla näkyy valitun viestin ympäristö ennen hyppyä.
- **3 Hakusivu**: ⌘K hyppää vain nimillä kuten kierroksella 1. Viimeinen rivi ”Hae kaikista keskusteluista” (⌘↵) avaa hakusivun keskustelun paikalle. Siinä suodattimet ovat vasemmalla ja osumat edellisen viestin kanssa, ja keskusteluun avatusta osumasta pääsee takaisin tuloksiin.

Issue `proto-rail-keyboard-navigation`. Suunnat, suositus ja päätökset ovat
issuen `result.md`:ssä, kierros 1 hakemistossa `../2026-11-15-rail-keyboard/`.

Sivu on tuotannon kehys kuten kierroksella 1: `AppShell`, `WorkspaceRail`,
`AgentNavItem`-rivit, `QuietSection`, `ConversationFrame`, `AgentHeader`,
`ConversationTimeline` viesteineen ja `Composer`. Kierroksen omaa on haun
ovi sivupalkin yläreunassa, vaihtaja, hakusivu, osumanauha ja haun
täsmäys. Osuman sanat korostetaan tuotannon viestin sisällä CSS Custom
Highlight API:lla, joten viestikomponentti pysyy tuotannon omana.

Kaikissa suunnissa sama:

- **Tyhjä haku** näyttää viimeksi avatut keskustelut, edellinen valmiina
  valittuna, joten ⌘K Enter vaihtaa kahden välillä kuten kierroksella 1.
  Listan lopussa on ”Jatka hakua: ’…’”, jos edellinen haku johti hyppyyn.
  Hypyn jälkeen ⌘K avautuu tyhjänä, jotta vaihto säilyy.
- **Hyppy viestiin**: keskustelu avautuu ja osunut viesti on keskellä
  rajattuna, sanat korostettuina. Kentän yllä on nauha ”Hakuosuma ’…’ ·
  Agentti, tänään”. Fokus on kirjoituskentässä.
- **Arkistoidut** ovat haussa mukana merkittyinä. Työkalujen tulosteet
  eivät ole oletuksena mukana.
- **Kun indeksi vielä rakentuu**, nimet löytyvät heti kaikki, koska ne ovat
  jo snapshotissa. Viestit tulevat tuoreimmasta alkaen, ja rivi kertoo
  edistymisen. Katselmoinnin palkin valinta ”Haku vielä rakentuu” näyttää
  tämän tilan.
- **Kosketus**: sivupalkin yläreunan ”Hae keskusteluista” -ovi avaa koko
  ruudun haun (1, 2) tai hakusivun (3). Esikatselu, näppäinvihjeet ja
  alarivi jäävät kapealla tai kosketusnäytöllä pois.

`?kbd=mac|pc`, `?theme=`, `?lang=en` ja `?building=1` valitsevat alkutilan.

## The key

| | macOS | Windows / Linux |
| --- | --- | --- |
| Open the switcher | **⌘K** | **Ctrl+K** |
| Also, outside text fields | **/** | **/** |
| Inside the terminal | not taken | **not taken** (readline kill-line) |
| Inside the code editor frame | not forwarded | not forwarded |

- **Ctrl+K on Windows/Linux.** Chrome, Edge and Brave bind it to the address
  bar's search, and Firefox to the search bar (or to the address bar where
  that bar is hidden). A page can take it with `preventDefault`, and GitHub,
  Slack, Linear and Notion do. The cost is that this one browser shortcut
  stops working while Habitat has focus. That is the convention people
  already meet on those sites, and the address bar is still reached with
  Ctrl+L or Alt+D. In a Windows/Linux textarea Ctrl+K does nothing, so the
  composer loses nothing. Kill-line is a macOS ⌃K, which ⌘K leaves alone.
- **The terminal keeps Ctrl+K.** The handler returns early while focus is in
  `.ah-terminal-surface`. Ctrl+Alt+T already leaves the terminal, after
  which Ctrl+K opens search.
- **/ is the second door.** It opens search only when focus is not in an
  input, textarea or contenteditable, as on GitHub and YouTube. It costs
  nothing, and on a keyboard without a comfortable Ctrl it is one key.
- **Rejected:** Ctrl+Shift+K (Firefox's web console), Ctrl+E (also the
  address bar's search on Windows/Linux, so nothing is gained), ⌘P / Ctrl+P
  (already the composer's file tree), Ctrl+Shift+F (free, but a two-modifier
  key for the most common use, and VS Code's "search in files" would make
  people expect files), F-keys (taken or behind fn on laptops).
- **Not verified on real machines:** Safari with ⌘K (believed free), and
  Firefox on Linux with the search bar shown. Check both before
  implementing.

## What real search can be on the host

Research sketch, no implementation. Measured on 15.11.2026 on one account's
own Pi history: the worker's Linux user, 363 session files. No content was
copied anywhere. The figures are sizes and times only, and the scratch index
was deleted.

### Where the text lives

- **Conversations** are Pi's native JSONL histories under
  `~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<id>.jsonl`. The daemon
  already discovers and reads them (`internal/daemon/history_linux.go`
  `nativeSessions`, `decodeNativeStream`). Entries are typed: `session`
  (header, cwd), `message` (`role` user / assistant / toolResult; an
  assistant message carries `text`, `thinking` and `toolCall` parts),
  `custom_message`, `custom`, `session_info` (the name), model and thinking
  changes.
- **Titles**: `session_info` names (generated or Pi's `/name`), otherwise
  the first prompt. The daemon already derives them (`nativeName`,
  `firstPrompt`).
- **Workspace** is the session header's cwd, mapped to a workspace by
  discovery as the snapshot does.
- **Archived** is the person's presentation annotation in the workspace's
  `user-state.json` (`archive_linux.go`). History is never moved, so
  archived conversations are searchable from the same files.
- **Worker runs** (spinoffs) are ordinary Pi sessions in their worktree's
  directory, already linked to their parent by the daemon. They are found
  the same way and shown under their parent's workspace.

### How big it gets

One active person, about two months of agent work:

| What | Size |
| --- | --- |
| Session files | 363, 237 MB on disk; median 290 kB, largest 14.7 MB |
| Tool results (text) | 17 081 entries, 58.8 MB |
| Tool call arguments | 17 082, 9.0 MB |
| Assistant text | 3 487 parts, 4.1 MB |
| Assistant thinking | 8 013 parts, 2.8 MB |
| Person's messages | 1 670, 2.1 MB |
| custom_message (skills, injected context) | 1 430, 1.6 MB |

**The conversation proper, the person's and the agent's words, is about
6 MB, 2.5 % of the bytes on disk.** Most of the rest is tool output and
JSON envelope. A heavy user might have ten times this in a year.

### Measured options

| Approach | Time on this history | Notes |
| --- | --- | --- |
| ripgrep over the raw JSONL, warm cache, 8 threads | ~10 ms | Matches inside tool output, JSON keys and escapes; no ranking; a snippet needs re-parsing the line |
| same, one thread | 60 ms | |
| cold read of all files (O_DIRECT) | 0.42 s | Guest disk; the first search after a reboot pays this |
| parse every line and extract person + agent text (Python; Go is several times faster) | 0.37 s | 5 156 non-empty messages |
| SQLite FTS5 (`unicode61`, prefix 2/3) over that text: build | 0.14 s | **15 MB** index |
| FTS5 query: count + top 20 with `snippet()` | **0.2–1.0 ms** | prefix (`kart*`), phrase, NEAR |
| FTS5 `trigram` tokenizer over the same text | build 0.45 s, 25 MB, query 0.3 ms | Substring match: compounds and mid-word hits |
| FTS5 over tool results as well | +0.7 s build, +84 MB | Index five times the size, for text people rarely want |
| in-memory regex over extracted text | 20 ms | Baseline for "no index at all" |

### Recommendation for the host (to be decided as architecture)

**A per-person incremental SQLite FTS5 index kept by that person's daemon,
over the person's and the agent's text, with tool output left out by
default.**

- **Why an index, not an on-demand scan.** A raw scan is fast while warm,
  but it matches tool output and JSON noise. It cannot rank or cut a clean
  snippet without parsing, and it grows linearly with history. Parsing on
  every query costs about 0.4 s now and seconds within a year. An index
  answers in about 1 ms with ranking and snippets, so every keystroke can
  search (target: results within 50 ms of a key, including the round trip).
- **Is this a "second store"?** It is a derived cache, rebuildable from the
  JSONL at any moment and never a source of truth. Deleting it loses
  nothing, and every hit is re-read from the native file before it is
  shown or opened. The project rule against speculative caches still means
  the maintainer decides this as architecture; this note is the
  recommendation. The no-index alternative is an on-demand parse with
  results streamed newest first. It works today at about 0.4 s and degrades
  with history.
- **Where.** In the daemon running as the person, as a file under that
  person's own state directory (for example `~/.local/state/`), mode 0600. It is never in the gateway, never shared and
  never root. A query goes through the same authorised per-user socket as
  history. The gateway learns nothing new, and one person's index cannot
  see another's files because the daemon cannot. This keeps today's
  authority split; no boundary changes.
- **Incremental.** Each session's indexed byte offset, size, mtime and
  inode are kept. Before answering, the daemon compares them with a stat of
  the session files, which it already lists for every snapshot. It also
  learns of turn ends from its own runs. Only the appended lines are parsed. A file that shrank or was replaced is
  reindexed. The first build runs newest first in the background, a few
  seconds even for a large history, and the UI says so (the "still
  building" state in this round).
- **What is indexed.** The person's messages, the agent's text answers,
  titles and the workspace name, with role, session id, entry id and time.
  Tool output, tool call arguments and thinking are left out by default.
  Tool output is noisy and five times the size. Thinking is not shown in
  the conversation by default, and a hit in text the person cannot see
  would confuse. File names the agent touched (from tool calls) would be a
  useful later field. Tool output could become an opt-in field
  ("Työkalujen tulosteet", as in direction 2) if people ask for it.
- **Finnish.** There is no Finnish stemmer in SQLite. Three options:
  (a) the `trigram` tokenizer, a substring match that finds compounds
  (*tilikartta* for *kartta*) and most inflected forms, but misses consonant
  gradation (*kartta* / *kartan*: "kartt" is not in "kartan"); (b) a
  query-side light ending strip (*kartan*, *kartalle* → *kart*), searched
  as a prefix or substring, which is what this round's prototype does;
  (c) a Snowball Finnish stemmer at indexing time (Go has ports; bleve
  bundles one). The suggestion is (a) + (b): trigram index, query words
  of five letters or more cut to a stem, and ranking that prefers whole-word
  and prefix matches (FTS5 `bm25` plus a boost). It needs no new
  dependency beyond SQLite with FTS5, which `modernc.org/sqlite` (pure Go)
  and `mattn/go-sqlite3` (cgo) both carry, and it works the same for
  English. The module has no SQLite today, so adding a driver is itself a
  major-dependency decision for the maintainer.
- **Snippets and jump.** FTS5's `snippet()` gives the matching sentence.
  Each row keeps the native entry id. Opening a hit needs a history page
  *around* an entry (today's pages run forward from `after`), a small
  addition to the history query. The browser then scrolls to the entry and
  marks the words.
- **Contract.** A new read-only query, `GET /api/v1/search?q=&who=&ws=&since=&archived=&limit=`,
  returning conversations (by name) and hits (agent id, entry id, role,
  time, snippet with match offsets), plus `index: {state: ready|building,
  done, total}`. It starts in `contracts/v1/`.
- **Privacy.** Search exists only inside one person's daemon, as above. The
  index file is as private as the histories it derives from, and a backup
  that includes the home directory includes it. It is deleted with the
  account. Admins see nothing new.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-15-switcher-search/build.mjs <kohde>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 500 \
  node design-system/prototypes/rounds/2026-11-15-switcher-search/check.mjs \
  <kohde>/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
