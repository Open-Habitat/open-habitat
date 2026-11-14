# Agentin paikka sivupalkissa – kierros 1

- **Nyt**: tuotanto tänään samoille keskusteluille. Valmiiksi ilmoittanut keskustelu on Sinun vuorosi -osiossa uutena vastauksena, ja workereita odottava rivi kertoo vain "Worker työskentelee".
- **1 Agentin rivi**: ilmoitus valitsee osion, ja agentin sanat ovat otsikon alla toisena rivinä. Workerin kysymys näkyy pääagentin rivillä, ja vanhentunut ilmoitus näkyy himmeänä kursiivina.
- **2 Sama kieli**: ilmoitus valitsee osion ja merkin, mutta rivi pysyy yksirivisenä havainnon näköisenä. Vain sinulle esitetty kysymys saa toisen rivin, ja vanhentunut ilmoitus jätetään pois.
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
ilman ilmoitusta sekä uudelleenkäynnistystä edeltänyt vanhentunut
ilmoitus. Tapahtumat: agentti kysyy sinulta workerin kysymyksen,
kirjoitat keskusteluun (ilmoitus päättyy), workerit valmistuvat (ilmoitus
päättyy). `?theme=light|dark|contrast` ja `?lang=en` valitsevat alkutilan.

Puhelimella neljä valitsimen nimeä mahtuvat riville vain sitoviin
välilyönteihin. Workerit-pallo ja Avustajat-siru ovat keskustelunäkymässä
kirjoituskentän yllä eivätkä tämän kierroksen sivupalkissa. Kysymys niissä
on kierroksen 2 asia (`worker-asks-parent`).

## What the host would need

Common to every direction (the declaration itself):

- **Agent command.** `open-habitat agent state set --current
  waiting-workers | needs-answer --question TEXT | done` and
  `state clear --current`. It runs as the user through the existing agent
  socket, so it is the same authority as `conversation update --current`
  and needs no new boundary: an agent can only declare something about its
  own conversation, and the person's own mark (`turn_mark`) stays theirs.
  Question length is bounded (one line, about 200 characters); the rail
  truncates it and the conversation shows it whole.
- **Daemon record.** It sits beside `turn_mark` per agent:
  `agent_state {kind, question?, at, turn_id, boot_id}`, in the
  snapshot and the agent stream. `turn_id` is the turn that set it, and
  `boot_id` is the daemon run that accepted it.
- **Expiry (the daemon's rules, not the agent's).** It is cleared when the
  person sends a message, when a new turn of the agent starts (except the
  turn that set it, so an agent can declare and then end its turn), and,
  for `waiting-workers`, when no worker of the agent is working or idle
  any more. `done` is also cleared by a newer reply.
  A record whose `boot_id` is not the current one is **stale**. It is
  kept so the rail can say so (direction 1), or dropped (directions 2 and
  3). Either way it no longer picks a section.
- **Rail rule (railNow).** `needs-answer` is the person's turn whatever the
  observation says. `waiting-workers` sorts as Käynnissä with the
  background mark while the agent is idle. `done` sorts as Hiljaiset
  even with an unread reply. A running turn always wins over a
  declaration: observation first, declaration only for an idle agent.

Worker's question (the context from `worker-asks-parent`):

- Taskfleet's ask/answer exchange (research proposal A) gives the open
  question, its worker run and its parent. Habitat reads it the same way it
  reads `spinoffs_working`/`spinoffs_idle` now: per parent agent,
  `worker_questions: [{run_id, worker, question, at}]`. The open question
  stays in Taskfleet, not in a Habitat store.
- Escalation is just the parent's own `needs-answer`, which may name the
  worker run (`--from-run RUN_ID`) so the rail can say whose question it is.
  The person answers in the parent conversation; the parent answers the
  worker. Habitat never answers a worker on the person's behalf.

Per direction:

- **1 Agentin rivi** needs everything above, plus the stale record kept
  with its `kind`. It also needs `worker_questions` with the worker's name
  for the parent row's line.
- **2 Sama kieli** needs the record without the stale case (dropped on
  boot) and the question text only for `needs-answer`. A worker's question
  only changes the parent's sub-dot (already `spinoffs_idle`).
- **3 Kysymysrivi** needs the same as 1, except the stale case, plus a
  stable id per question (Taskfleet's question id, or the agent's
  `turn_id`) so the question row can be its own list item and link to the
  question in the conversation.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-rail-agent-state/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-14-rail-agent-state/check.mjs \
  design-system/prototypes/dist/rail-agent-state/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Tarkistus: 457 tarkistusta, konsoli puhdas.
