# Rail scroll region: prototype round 1

## Saatesanat

Tein sivupalkista kolme suuntaa ruuhkatilanteeseen: 6 keskustelua Sinun
vuorossasi, 5 käynnissä, 30 hiljaista ja 40 työtilaa. Mukana on myös
tavallinen tilanne (2 / 1 / 5 ja 24 työtilaa). Kaikki kolme lopettavat
koko palkin vierimisen, joten Työtiloja selatessa keskustelut eivät enää
katoa näkyvistä. Ne eroavat siinä, mitä tapahtuu, kun keskustelutkaan
eivät mahdu. Suosittelen ykköstä. Työtilat vierii omassa alueessaan, ja
keskustelut saavat kaiken muun tilan. Jos niitäkään ei mahdu kaikkia
näkyviin, niiden alue vierii erikseen, ja alueen ylä- ja alareuna
kertovat, mitä on piilossa: esimerkiksi "↑ Sinun vuorosi 4" ja
"↓ Hiljaiset 30". Nimeä napauttamalla pääsee osioon. ⌥↑/⌥↓ tuo avatun
rivin näkyviin kaikissa suunnissa. Kokeile 700 px:n korkeudella ja
avoimilla Hiljaisilla, siinä erot näkyvät selvimmin.

## Where to look

- Page: `design-system/prototypes/dist/rail-scroll/offline.html`
  (built with `node design-system/prototypes/rounds/2026-11-16-rail-scroll/build.mjs`,
  not committed). The picker switches *Työtilat* / *Laatikot* / *Katto*. The
  review bar selects the situation (crowded / ordinary), the height (browser
  window, 900, 700 or 560 px shell), the theme and the language.
- Sources and commands: `design-system/prototypes/rounds/2026-11-16-rail-scroll/`
  (`NOTES.md`).
- Captures (not committed): `/var/tmp/agent-keep/rail-scroll/`. `rail-*.png`
  shows the rail alone and the others the whole page. `rows.json` is the table
  below.

## Axis and directions

The axis is **which part of the rail scrolls when it is crowded**. All
three directions stop the whole rail from scrolling, which is what made the
conversations vanish. The head (server, Etusivu), the search door and
the account foot stay fixed in every direction, and so do Työtilat's
heading, its new-workspace button and its filter. Only Työtilat's list
scrolls. Each workspace row's + (new conversation) scrolls with its row.

1. **Työtilat omana alueenaan.** Sinun vuorosi, Käynnissä and Hiljaiset
   share one region at the top. It takes all the height except Työtilat's
   floor (heading, filter and about three rows). Työtilat's list scrolls in
   its own region. When the conversations do not fit either, their region
   scrolls separately, and its edges name what is out of sight: the
   sections with rows above (↑) or below (↓) and how many rows. A name
   scrolls to its section. The names overlay the edge row, so they never
   move the rows.
2. **Osiot laatikoissa.** Each conversation section is a box with its own
   maximum height (roughly a quarter, a fifth and a fifth of the content
   height) and its own scroll. The heading sticks to the top of its box.
   Työtilat gets the rest. When even the smallest boxes do not fit (560 px,
   phone), the column of boxes scrolls too.
3. **Katto ja Näytä kaikki.** Each section shows a few rows: 4/3/3 in a
   900 px window, 3/2/2 at 700 px and 2/1/1 below that. "Näytä kaikki · n
   lisää" opens the rest in place, and "Näytä vähemmän" closes them. The
   open conversation is never hidden by the cap. Työtilat scrolls as in 1.
   If what is shown still does not fit, the conversations' region scrolls,
   with no edge names.

## What each shows when crowded

Rows fully in sight, out of the section's rows. The browser-window shell is
900 px, at 1440 wide unless noted. Hiljaiset is open unless noted.

| Case | 1 Työtilat | 2 Laatikot | 3 Katto |
| --- | --- | --- | --- |
| 900 px | 6/6 · 5/5 · 0/30, ↓ names Hiljaiset 30 · ws 3/40 | 4/6 · 3/5 · 3/30 · ws 3/40 | 4/6 · 3/5 · 3/30 · ws 3/40 |
| 900 px, Hiljaiset folded | 6/6 · 5/5 · ws 3/40 | 4/6 · 3/5 · ws 3/40 | 4/6 · 3/5 · ws 3/40 |
| 1024 × 768 | 6/6 · 2/5 · 0/30 · ws 3/40 | 2/6 · 2/5 · 2/30 · ws 3/40 | 3/6 · 2/5 · 1/30 · ws 3/40 |
| 700 px | 5/6 · 1/5 · 0/30 · ws 3/40 | 1/6 · 1/5 · 2/30 · ws 3/40 | 3/6 · 2/5 · 0/30 · ws 3/40 |
| 560 px | 1/6 · 1/5 · 0/30 · ws 3/40 | 1/6 · 1/5 · 0/30, boxes in a scroller | 2/6 · 1/5 · 0/30 · ws 3/40 |
| Phone drawer (390, ≈650 px under the review bar) | 2/6 · 1/5 · 0/30 · ws 3/40 | 1/6 · 1/5 · 0/30, boxes in a scroller | 2/6 · 1/5 · 0/30 · ws 3/40 |
| Ordinary, 900 px | everything · ws 6/24 | Hiljaiset 3/5 in its box · ws 7/24 | Hiljaiset 3/5 behind the cap · ws 8/24 |
| Ordinary, 700 px | 2/2 · 1/1 · 2/5, ↓ names Hiljaiset | 1/2 · 1/1 · 2/5 · two boxes scroll | 2/2 · 1/1 · 2/5 |

Reading the table:

- **1** keeps whole sections together and says what it cannot show. In the
  ordinary 900 px case it scrolls nothing but Työtilat. In a crowd it is the
  only direction where a hidden section is still named.
- **2** looks tidy in a still picture, but it has up to four scrolling
  regions in a 280 px column. A trackpad scroll moves whichever box the
  pointer is over. It caps Hiljaiset even in ordinary use. At 560 px and on
  the phone the boxes sit inside another scroller.
- **3** shows a bit of everything, but the cap hides conversations at every
  height, also in ordinary use (Hiljaiset 3/5). In a short window Hiljaiset's
  heading drops out of sight below the cap with no cue, which is the
  original problem in a smaller form.

## Covered and checked

`check.mjs` covers the following with 1,395 checks and a clean console.
Crowded: 1440 at 900 px in Päivä, Yö and Kontrasti, Hiljaiset folded, 1024 ×
768 in Finnish and English, 700 px (light, and dark folded), 560 px, and the
390 px drawer in light and dark. Ordinary: 900 px, 700 px and the phone.
Each direction in each case:

- the whole rail does not scroll, and the rail content box stays at
  scrollTop 0;
- the open row is in sight, not under a sticky heading or an edge name;
- Työtilat's new-workspace button and its filter are in sight;
- Sinun vuorosi's rows are in sight, or (1) its name is at the top edge;
- Työtilat scrolls to its last row, the edge cue marks rows above, the last
  row's + (new conversation) shows on hover, and the conversations in
  sight do not change;
- (1) ↓ and ↑ name the hidden sections and scroll to them, and with nothing
  hidden every heading is in sight;
- (3) Show all opens and Show less closes, Työtilat stays in sight, and a
  folded Hiljaiset has no Show all.

**Keyboard:** from the composer, ⌥↓ through all 40 rows to the end and ⌥↑
back. Each opened row is in sight and the whole rail never moves. This is
checked at 900 and 700 px in all three directions. In 3, a row behind the
cap opens and shows, because the cap never hides the open row.

**Edge cue:** a soft shadow inside the edge that hides rows, with a hairline
when rows hide above. It is drawn only on an edge that actually hides
something. 1 adds the section names at the conversations' edges.

## Recommendation

**1 Työtilat omana alueenaan.** It is what Jari asked for: Työtilat is the
part that scrolls, and browsing it never moves a conversation. Ordinary use
gets one scrolling region and no hidden conversations. When the
conversations themselves overflow, 1 is the only direction that still says
where they are ("↑ Sinun vuorosi 4", "↓ Hiljaiset 30"), and that cue
answers the original "where did my conversations go?" directly. 2 adds
nested scroll regions, and 3 hides conversations in ordinary use and loses
Hiljaiset in short windows without a word.

## What implementation would need

Web only. No host, contract or daemon change.

- `.ah-rail-content` stops scrolling (`overflow: clip`, not `hidden`, so that
  `scrollIntoView` cannot move it). The conversation sections get a wrapper
  region (`overflow: auto; flex: 0 1 auto; min-height: 0`). `.ah-rail-workspaces`
  becomes a column with a floor, and `.ah-workspace-list` scrolls.
- The rail keys (`railKeyboardOrder` in the shell) call
  `scrollIntoView({block: "nearest"})` on the opened row. Today production
  does not reveal the target row. The conversations' region keeps
  `scroll-padding-block` so a revealed row clears the edge names.
- The edge names are computed from the rendered rows on scroll and resize,
  and are counted against the cue's fixed height whether it shows or not, so
  that the cue does not oscillate. They need an accessible name per button,
  which the prototype has ("Vieritä osioon Hiljaiset: 30 keskustelua
  alempana").
- On load and when the window height changes, the open row is brought into
  sight again.

## Decisions for later review

- **Työtilat's floor: heading, filter and about three rows** (11 rem, 13.5 rem
  on touch). Alternatives: a fixed share of the height (tried first: at
  700 px it left the ordinary case scrolling) or no floor (a crowd would
  push Työtilat out entirely). Three rows keep it obviously a list.
- **Worktrees are shown as production shows them**, as conversation rows
  with the branch mark and "2 muutosta", not nested under workspaces. The
  rail has no nested worktree rows today, and inventing them would mix in a
  second question.
- **Edge names show only rows fully out of sight**, and a folded Hiljaiset
  out of sight shows its total. Alternative: name a section as soon as its
  heading leaves. That flickered and named sections whose rows were still
  visible.
- **3's caps (4/3/3, 3/2/2, 2/1/1) follow the content height**, not the
  number of conversations. Alternative: one cap for all heights. It made a
  700 px rail scroll anyway.
- **The phone is checked under the review bar**, so the drawer is about
  650 px instead of a phone's full height. The real drawer is taller, and
  the numbers above are the pessimistic case.
- **Picker names are single words** (*Työtilat*, *Laatikot*, *Katto*) because
  numbered names wrapped on the phone. The numbered lines at the top of the
  page say which is which.

## Questions for Jari

1. Is three rows the right floor for Työtilat in a crowd? With 30 Hiljaiset
   open, 1 gives the conversations everything else. Would you rather
   Työtilat keep, say, a third of the rail?
2. Are the edge names in 1 (↑/↓ with section and count) the right cue, or
   is a plain shadow enough? The names were added because a shadow alone
   did not say that Hiljaiset existed.
3. Should Hiljaiset fold itself when the rail is crowded? Folded, 1 shows
   all of Sinun vuorosi and Käynnissä at 900 px with nothing to scroll.
