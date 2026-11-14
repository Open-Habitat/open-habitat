# Agentin paikka sivupalkissa – kierros 1

- **Nyt**: tuotanto tänään samoille keskusteluille. Valmiiksi ilmoittanut keskustelu on Sinun vuorosi -osiossa uutena vastauksena, ja workereita odottava rivi kertoo vain "Worker työskentelee".
- **1 Agentin rivi**: ilmoitus valitsee osion, ja agentin sanat ovat otsikon alla toisena rivinä. Workerin kysymys näkyy pääagentin rivillä, ja rauennut ilmoitus näkyy himmeänä kursiivina.
- **2 Sama kieli**: ilmoitus valitsee osion ja merkin, mutta rivi pysyy yksirivisenä havainnon näköisenä. Vain sinulle esitetty kysymys saa toisen rivin, ja rauennut ilmoitus jätetään pois.
- **3 Kysymysrivi**: kuten 2, mutta jokainen avoin kysymys (worker → agentti, agentti → sinä) on oma sisennetty rivinsä keskustelunsa alla.

Issue `agent-sets-rail-state`, taustana `worker-asks-parent`. Suunnat,
suositus ja päätökset ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`), `NowSections`in
osiomerkintä, tuotannon `QuietSection`, `HabitatMark` alamerkkeineen ja
`NavLink`in toinen rivi (`line`). Nyt-näkymän rivit ovat tuotannon
`AgentNavItem`. Kierroksen oma on vain `RailRow`, joka on `AgentNavItem`in
merkintä ja lisäksi rivi ja merkki, jonka ilmoitus asettaa: tuotannon
`AgentNavItem` antaa `line`-propin vain työpuun työlauseelle eikä ota
merkkiä vastaan. Toteutus tarvitsisi `AgentNavModel`iin kentän
ilmoitetulle tilalle (tai yleisen `line`-kentän), ja `agentMark` lukisi
sen. Oikealla oleva tarina (komennot, tila ja Tapahtumat-painikkeet) on
katselmoinnin apu eikä ehdotus käyttöliittymäksi.

Kaikissa suunnissa on samat seitsemän tilannetta: vuoro käynnissä,
workereita odottava agentti (agentti joutilaana), workerin kysymys, johon
pääagentti vastaa, sinulle esitetty kysymys, valmis-ilmoitus, uusi vastaus
ilman ilmoitusta sekä workereita odottava ilmoitus, joka raukesi, kun palvelin käynnistyi uudelleen eikä yhtään workeria enää näy. Tapahtumat: agentti kysyy sinulta workerin kysymyksen,
kirjoitat keskusteluun (ilmoitus päättyy), workerit valmistuvat (ilmoitus
päättyy). `?theme=light|dark|contrast` ja `?lang=en` valitsevat alkutilan.

Puhelimella neljä valitsimen nimeä mahtuvat riville vain sitoviin
välilyönteihin. Workerit-pallo ja Avustajat-siru ovat keskustelunäkymässä
kirjoituskentän yllä eivätkä tämän kierroksen sivupalkissa. Kysymys niissä
on kierroksen 2 asia (`worker-asks-parent`).

## What the host would need

The host model is the parallel design, `issues/worker-asks-parent/design.md`
§2 (the agent's handoff) and §2.4 (a worker's question). The round follows
it: the commands in the story are its `open-habitat agent handoff create
--current --state waiting_workers | needs_answer --text … | done`. The
handoff is a custom entry on the native Pi branch, read by the branch scan
into an optional `handoff {state, text, at}` on the snapshot agent. Its
scope runs from the end of the declaring turn to the start of the next.
`waiting_workers` lapses when Habitat sees none of the conversation's runs
working, and observation still wins over a handoff (a running turn, a
failure, the person's marks, a native question). The design is not
restated here. This list says only what each direction needs from that
model beyond it.

- **Common.** railNow reads `handoff` in the design's order, and
  `AgentNavModel` gets a field for the declared state (or a general
  `line`) that `agentMark` and the row read. Today `AgentNavItem` takes a
  second line only for a worktree's work. The waiting row's count ("kahta
  workeria") comes from `spinoffs_working`, which the snapshot already
  has.
- **1 Agentin rivi.** It needs the lapsed case, not just its absence: the
  snapshot (or railNow) must keep a lapsed `waiting_workers` handoff
  visible as lapsed for as long as its reply waits. The design drops it
  silently and places the row by observation. The worker's line on the
  parent row needs the open ask's worker name and question on the parent
  agent (slice 3's `ask` on worker rows, aggregated per parent like
  `spinoffs_idle`).
- **2 Sama kieli.** It needs exactly the design's slice 1: the handoff's
  state and, for `needs_answer`, its text. A worker's question changes only
  the parent's sub-dot, which `spinoffs_idle` already gives.
- **3 Kysymysrivi.** It needs the same as 1, without the lapsed case, plus
  a stable id per question: Taskfleet's ask id for a worker's question and
  the handoff entry's id for the agent's. With these the question row is
  its own list item and links to the question in the conversation.

Not shown, from the design §2.4: an ask left unescalated for five minutes
while the parent's turn is not running reaches Sinun vuorosi as *Worker
odottaa vastausta*, and a timed-out ask returns to observation. Both fit
direction 1's line and direction 3's question row unchanged, so they are
candidates for round 2. So is Ei nyt on a `needs_answer` row, which this
rail does not draw.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-rail-agent-state/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-14-rail-agent-state/check.mjs \
  design-system/prototypes/dist/rail-agent-state/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Tarkistus: 457 tarkistusta, konsoli puhdas.
