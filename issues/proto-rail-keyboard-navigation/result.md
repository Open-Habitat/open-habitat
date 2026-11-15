# Prototype round 3: how the ⌘K list presents its results (15.11.2026)

**Yhteenveto.** Kierros pitää kierroksen 2 kapean listan, näppäimen ja
haun ja vaihtaa vain sen, mitä listan yksi rivi on. **Suositus on
1 Keskustelut**: yksi järjestetty lista ilman osioita. Jokainen rivi on
keskustelu, ja rivin sisällä näkyy sen paras osuva lause korostettuna.
Nimiosuma on samanlainen rivi ylimpänä. Keskustelun muut osumat ovat
määränä ”+4 osumaa →”: → avaa ne rivin alle ja ← sulkee. Enter avaa
keskustelun juuri näkyvän lauseen kohdalta. Vaihtoehdot ovat 2 Viestit
(rivi on yksi viesti, keskustelun nimi pienenä tunnisteena) ja
3 Kaksi vaihetta (ensin vain keskustelut osumamäärineen, → avaa yhden
keskustelun osumat). Tyhjällä haulla ⌘K Enter vaihtaa yhä kahden
keskustelun välillä.

Round `design-system/prototypes/rounds/2026-11-15-switcher-list/` (its
`NOTES.md` has the rules). The axis is **what one row of the list is, and
where the rest of the hits go**. The view is round 2's: the production rail
and conversation at 1440 with the narrow list over it, and the 390
full-screen sheet opened from the rail's door. It has three themes, Finnish
and English, Mac and Windows/Linux labels, and is keyboard-live with real
search over the synthetic conversations. A review-bar "Tilanne" select
switches between the cases: empty query, many hits (*kartta*), a title
match (*sanasto*) and no hits (*laskutus*).

- **1 Keskustelut**: a row is a conversation, and its second line is its
  best matching sentence. A title match is the same kind of row, ranked
  first. Other hits are a count; → expands them indented under the row,
  ← folds them. Enter opens at the sentence shown, or at a chosen sub-row.
  With no query, or a title-only match, the second line is the latest
  message, muted.
- **2 Viestit**: a row is one matching message, with its conversation as
  a small label. A conversation gets a row of its own only when the query
  matches its name, tagged "nimessä"; Enter there opens it at the latest
  message. → shows the message before it inline, ← hides it.
- **3 Kaksi vaihetta**: while typing, only conversations with "N osumaa ›".
  → opens that conversation's hits as a second list under a
  "← Keskustelut" heading, and ← returns to the same row. Enter on a
  conversation opens its newest hit.

In all three, → and ← stay with the field's caret unless the list has
something to open or close (→ only at the end of the text). On touch the
count (1) and the chevron (3) are buttons. "Continue search" and the empty
result work as in round 2, and the jump band and in-message highlight are
round 2's.

**Recommendation: 1 Keskustelut.** It fixes what confused: nothing is in
two places and nothing sits under a heading. One row answers "which
conversation", and the sentence inside it says why, so a common word gives
one row per conversation rather than a dozen sentences. Direction 2 is the
most exact when the sentence is what you remember, but a common word floods
it with near-identical rows from the same conversation, and the
conversation is the thing you open. Direction 3 is the tidiest list, but
without a sentence the person cannot tell which conversation is right
without stepping in, which costs a key press every time.

Checks: `check.mjs`, 330 checks, clean console. Every direction at 1440 in
Päivä/Yö/Kontrasti and at 390 touch in Päivä/Yö shows its own row shape on
*kartta*, without overflow. At 390 the door opens the sheet, and tapping
the count (1) and the chevron (3) works. Then per direction from the
keyboard: the four cases, Esc, Ctrl+K and `/`, the ⌘K Enter swap, → / ←
(expand, context, drill) and the caret mid-text, Enter to the right message
with band and highlight, Continue search, the title match and the empty
result. Last come ⌘K on a Mac and English. Review: focused self-review, since nothing in the
daemon, contract, session state or an authority path changed. The page
(`offline.html`) and screenshots are in the run's worker-results directory.

Live check: nothing changed on the test server. Open the round page
(`offline.html`). In each direction, try the "Tilanne" select, then type
*kartta* and press → and ← on Karttatiilten välimuisti, and Enter on a hit.
Then Esc, and Ctrl+K Enter (⌘K on a Mac) to swap.

## Decisions for later review (round 3)

- **Title matches rank first, archived last within each group, then the
  newest hit, then the number of hits.** Alternatives: recency only, or a
  score that mixes them. A name is what people jump by, so a title match is
  the strongest signal, and old archived work should not push today's
  aside.
- **A conversation's "best" sentence is its newest hit where the word
  starts a word, otherwise its newest hit.** Alternative: the hit with the
  most query words, or the oldest. Newest matches how people remember
  recent work, and a word-start hit reads as a real match rather than a
  compound fragment.
- **→ acts only at the end of the field's text, and ← only when something
  is open.** Otherwise both keys move the caret. Alternative: → and ← always
  belong to the list (Raycast). Editing a query is common, and a key that
  sometimes moves the caret and sometimes opens rows is predictable only
  with this rule.
- **The empty query in direction 1 shows the latest message under each
  recent conversation**, which makes the empty list two lines per row.
  Alternative: one line, as in 2 and 3. The same row shape for typed and
  empty states keeps direction 1 one list.
- **The narrow list keeps round 2's 640 px width.**

# Prototype round 2: the ⌘K switcher with real search across all conversations (15.11.2026)

**Yhteenveto.** Kierros vastaa Jarin kysymykseen, voisiko ⌘K-vaihtajassa
olla aito haku kaikkiin agenttikeskusteluihin. Voi, ja se on hostilla
halpaa. Yhden aktiivisen käyttäjän kahden kuukauden Pi-historia vie 237 Mt,
mutta ihmisen ja agentin varsinaista tekstiä siinä on vain noin 6 Mt.
Loppu on työkalujen tulosteita ja JSONia. Henkilön oman daemonin SQLite
FTS5 -indeksi tälle tekstille rakentuu 0,14 sekunnissa ja vastaa noin
millisekunnissa. Kierros näyttää kolme tapaa sijoittaa nimet ja
viestiosumat vaihtajaan, oikeilla tuotannon komponenteilla ja toimivalla
haulla. **Suositus on 2 Esikatselu**: leveä haku, jossa osumat ovat
keskusteluittain ja suodattimet kentän alla. Oikealla näkyy valitun viestin
ympäristö ennen hyppyä, ja Enter avaa keskustelun juuri siitä viestistä.
**Näppäin on Macilla ⌘K ja Windowsilla ja Linuxilla Ctrl+K**: sivu ottaa
sen selaimen osoiterivin haulta kuten GitHub ja Slack, mutta ei koskaan
päätteestä. Toinen ovi on `/` tekstikenttien ulkopuolella. Indeksi on uusi
johdettu tallenne henkilön daemonissa, ja se on arkkitehtuuripäätös, jonka
Jari tekee ennen toteutusta (alla).

Round `design-system/prototypes/rounds/2026-11-15-switcher-search/`. Its
`NOTES.md` has the key table per platform, the host research with
measurements, and the recommended search design. The axis is **how name
matches and message matches share the switcher**. The view is the
production rail and conversation at 1440 with the switcher over it,
keyboard-live and searching for real. There are three themes, Finnish and
English (example query *kartta* / *map*), a "still building" toggle, Mac /
Windows-Linux key labels, and a 390 touch view where the rail's new
"Hae keskusteluista" door opens a full-screen sheet.

- **1 Lista**: a narrow list. Names first, then message hits with the
  matching sentence highlighted, at most two per conversation and then a
  count. No filters.
- **2 Esikatselu**: the same search as a wide dialog. Hits are grouped by
  conversation. Filter chips sit under the field: who said it, workspace,
  when, archived included, tool output. Tab reaches them. A preview pane
  shows the selected message with its neighbours, and on a narrow screen it
  becomes direction 1's list.
- **3 Hakusivu**: ⌘K jumps by name only, as in round 1. Its last row,
  "Hae kaikista keskusteluista" (⌘↵), opens a search page in place of the
  conversation, with filters in a column and each hit shown with the
  message before it. A conversation opened from a hit has a band back to
  the results.

In all three, an empty query lists recently opened conversations with the
previous one chosen, so ⌘K Enter still swaps between two. A
"Continue search" row brings back the last query. Enter on a hit opens the
conversation at that message, centred and outlined, with the words marked
inside the production message. A band names the query. Archived
conversations are included and labelled. While the index builds, every name
is found at once and messages arrive newest first.

**Recommendation: 2 Esikatselu.** Search and choice stay in one
keyboard-driven dialog. The preview answers "is this the place?" before a
whole history loads. Filters are there without a second view to maintain,
and the narrow form is direction 1. Direction 1 is the cheapest, but with a
dozen hits for a common word it leaves the person guessing which
conversation is right. Direction 3 suits long research sessions, but it
adds a route and a mode, and ⌘K alone would no longer search text, which
is what Jari asked for.

**Host search (research, `NOTES.md`):** a per-person incremental SQLite
FTS5 index in the daemon over the person's and the agent's messages, titles
and workspace names. Tool output and thinking are left out by default.
Words are matched with a trigram tokenizer for substrings and compounds,
plus a light Finnish ending strip on query words of five letters or more
(*kartan* → *kart*). A new read-only `GET /api/v1/search` returns name and
message hits with entry ids. The history query needs a page *around* an
entry so the browser can jump to it. Nothing changes in who acts as whom:
the index lives and is queried only inside the person's own daemon.

Checks: `check.mjs`, 226 checks, clean console. It covers every direction
at 1440 in Päivä/Yö/Kontrasti and at 390 touch in Päivä/Yö, including the
rail's door and the full-screen sheet. Then from the keyboard: Esc, Ctrl+K
and `/`, recents and the ⌘K Enter swap, inflected and compound matches,
archived included, tool output excluded, arrows to a hit and Enter to the
message with band and highlight, Continue search, the empty result,
direction 2's filters and Tab, direction 3's page, Ctrl+Enter, filters and
back from a hit, the building state in all three, ⌘K on a Mac and English.
The review was a focused self-review: nothing in the daemon, contract,
session state or an authority path changed. The page and screenshots are in
the run's worker-results directory.

Live check: nothing changed on the test server. Open the round page
(`offline.html`). In 1 and 2, press Esc, then Ctrl+K (⌘K on a Mac) and
Enter to swap, then type *kartan* and open the agent's question in
Saavutettavuuskorjaukset. In 2, try the filter chips. In 3, press Enter on a
hit and use the band to go back to the results.

## Decisions for later review (round 2)

- **The index is an architecture decision for Jari.** A derived,
  rebuildable SQLite file in the person's daemon is a new local store and a
  new major dependency (no SQLite in the module today), which the project
  rules leave to the maintainer. The alternative without an index is an
  on-demand parse streamed newest first, about 0.4 s on this history and
  growing with it. Recommendation in `NOTES.md`. If chosen, record it as an
  ADR or issue before code.
- **Ctrl+K on Windows/Linux, not a free key.** Alternatives were
  Ctrl+Shift+F (free but two modifiers, and it suggests "search in files")
  and Ctrl+E (also the address bar). Ctrl+K is the convention on the sites
  people already use, the address bar stays at Ctrl+L / Alt+D, and `/`
  adds a one-key door.
- **⌘K opens empty after a jump** so that ⌘K Enter keeps swapping, with
  "Continue search" in the recents. Alternative: reopen with the last query
  selected (VS Code). That breaks the swap Jari already approved in round 1.
- **Archived conversations are searched by default** and labelled.
  Alternative: excluded unless asked for. Search is where old work is
  looked for, and archive only hides a row.
- **Tool output and thinking are not searched by default.** Tool output is
  five times the index and mostly noise. Thinking is hidden in the
  conversation, so a hit inside it could not be shown. Direction 2 and 3
  offer tool output as a filter.
- **The index builds newest first, and names never wait.** Names come from
  the snapshot the browser already has.
- **The touch entry is a "Hae keskusteluista" door at the top of the rail**
  (one tap to open the rail, one to search). Alternative: an icon in the
  mobile header, which is one tap but adds a header control on every view.
  The desktop door also teaches the key by showing its cap.
- **Not built in this round:** search in Explain mode, and recent searches
  beyond the last one.

# Prototype round 1 — keyboard shortcut for moving between conversations (15.11.2026)

**Yhteenveto.** Kierros näyttää kolme näppäinvaihtoehtoa oikeilla
tuotantokomponenteilla. Näppäimet toimivat sivulla oikeasti, myös
kirjoituskentästä. **Suositus on 1 Suoraan: ⌥↑/⌥↓ (Alt+↑/↓) avaa sivupalkin
edellisen tai seuraavan keskustelun, ja ⌥⇧↓ vie seuraavaan sinua
odottavaan.** Se on Slackin ja Discordin tapa ja ainoa nuolipari, jota mikään
selain ei vie millään alustalla. Se jatkaa myös nykyistä ⌥↓-näppäintä.
Hinta maksetaan Macilla kirjoituskentässä: ⌥↑/↓ ei enää hyppää kappaleen
alkuun tai loppuun. ⌘K-vaihtaja on hyvä lisä myöhemmin. Toteutus on pelkkää
selainkoodia.

Round `design-system/prototypes/rounds/2026-11-15-rail-keyboard/`. Its
`NOTES.md` has every key Habitat binds today, the collision table
(Safari/Chrome/Brave/Firefox on macOS, Chrome/Firefox on Windows/Linux, the
composer, the terminal and the editor frame), comparable apps, the
discoverability plan and "What the host would need". The axis is **which key
moves between the rail's conversations, and whether it opens at once,
searches or browses first**. The view is the rail and the open conversation at
1440, keyboard-live. A review-bar toggle switches the key labels between
Mac and Windows/Linux, and another shows the Explain-mode sentence. There are
three themes, Finnish and English, and a 390 touch view where nothing changes.

- **1 Suoraan**: ⌥↑/⌥↓ opens the previous/next row in the visible rail order
  at once and keeps focus in the composer. ⌥⇧↓/⌥⇧↑ goes to the next/previous
  conversation in Sinun vuorosi. The Meanwhile row's key changes from ⌥↓ to
  ⌥⇧↓.
- **2 Vaihtaja**: ⌘K / Ctrl+K opens a type-to-filter switcher in rail order
  with section headings. An empty search preselects the previous
  conversation, so ⌘K Enter swaps between two. ⌥↓ stays the Meanwhile key.
- **3 Selaa ensin**: ⌥↑/⌥↓ moves keyboard focus into the rail onto the
  neighbouring row without opening it. Then plain ↑↓ browse, Enter opens and
  returns to the composer, and Esc goes back unchanged.

**Recommendation: 1 Suoraan.** It takes one key press from the composer, has
no mode to leave, and is the convention people already know from chat apps.
It also grows from the one rail key Habitat already has. Direction 2 is the
better tool once there are dozens of conversations, but Ctrl+K is the
address bar's search in every browser and kill-line in the terminal. It also
does not step through the list, which is what was asked for. Direction 3
avoids loading every conversation passed on the way, but it adds a mode with
its own keys, and the second press already reaches what direction 1 does in
one.

Checks: `check.mjs`, 151 checks, clean console. It covers every direction at
1440 in Päivä/Yö/Kontrasti and at 390 touch in Päivä/Yö, then presses the
keys: stepping, waiting jumps, drafts kept per conversation, the end of the
list, the switcher's open/swap/filter/Esc, rail browsing with Enter and Esc,
the picker not taking the arrows, the labels, the Explain card and English.
The page and screenshots are in the run's worker-results directory.

Live check: nothing changed on the test server. Open the round page
(`rail-keyboard.html`), click into the message field and try ⌥↓ ⌥↑ ⌥⇧↓ in 1,
⌘K in 2 and ⌥↓ ↓ Enter / Esc in 3.

## Decisions for later review (round 1)

- **Alt+Shift jumps to the waiting conversations, not between sections.**
  Alternative: first row of the next section (Sinun vuorosi / Käynnissä /
  Hiljaiset). Waiting-for-you is the jump people need, it is Slack's and
  Discord's "unread" key, and it absorbs the Meanwhile row's job.
- **Direction 1 moves the Meanwhile key to ⌥⇧↓.** Alternatives: keep ⌥↓
  meaning "next waiting" while the row shows. That makes one key mean two
  things depending on a row that comes and goes. Or drop the row's key.
- **Up/down only, no wrap at the ends.** Left/right are back/forward on
  Windows/Linux and word motion in the composer. Wrapping would send a held
  key round the list forever.
- **Steps follow the visible rail order**, including Hiljaiset when it is
  unfolded. Alternative: only Sinun vuorosi and Käynnissä. The visible order
  is the only one a person can predict from the screen.
- **Each step opens the conversation at once (1).** Alternative: 3's browse
  first. Opening is what was asked for, and a cancelled history load is
  cheap.
- **The terminal and the editor keep their keys.** Alt+↑↓ and Ctrl+K go to the
  shell (tmux and readline use them), and nothing is forwarded from
  code-server, where Alt+↑↓ moves lines.
- **The first-use tip appears after three mouse switches** and is
  dismissed for good. Alternatives: always-visible key caps in the rail
  (noise), or no tip at all, leaving only the Meanwhile row and Explain mode.
  The page shows the tip on load so it can be reviewed.
- **Not checked in this round:** whether Safari takes ⌘K, and Firefox's
  handling of Alt+↑↓ on Linux. `NOTES.md` marks these "?".
