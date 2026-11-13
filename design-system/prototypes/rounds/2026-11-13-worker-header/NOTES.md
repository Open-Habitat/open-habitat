# Workerin yläpalkki – kierros 1

Issue `proto-worker-header-status`. Suunnat, suositus ja kysymykset ovat
issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja workerin näkymä
koottuna tuotannon paloista samassa järjestyksessä kuin `WorkerView`
(`web/src/components/Spinoffs.tsx`): nauha tuotannon luokilla
(`ah-worker-band`, `ah-worker-kind`, `ah-worker-parent`, `ah-worker-meta`,
`ah-worker-ask`), `AgentHeader`, `WorkerBrief` ja `ConversationTimeline`.
`AgentHeader` ottaa jo vastaan `gitStatus`-, `contextIndicator`- ja
`modelPicker`-paikat; `WorkerView` ei vain täytä niitä. Git on tuotannon
`GitStatusChip` ja `GitStatusDetails`, konteksti tuotannon `ContextRing`.
Kierroksen omia ovat vain rehelliset "?"-painikkeet (sama `ControlButton`,
`Ring` ja luokat) sekä PR-pilleri, jonka tuotanto näyttää nyt lauseen
linkkinä.

Kaksi suuntaa eroavat vain siinä, missä painikkeet ovat: otsikkorivillä
kuten keskustelussa (1) tai nauhassa (2). Malli ja rengas ovat vain luku:
molemmat avaavat workerin Tiedot, joissa ovat malli, kontekstilause,
haarat ja run-ID. `?case=alussa|pr|lukematon` ja `?theme=dark` valitsevat
alkutilan.

Kokeiltu ja jätetty pois: kolmas suunta "Yksi palkki" (ei nauhaa,
pääkeskustelulinkki työtilan paikalla, Vain luku -merkki ja Kysy
otsikkorivillä). Tuotannon otsikon lyhennys vei 1440 px:n leveydellä
sivupalkki auki pääkeskustelulinkin ja Gitin luvut ⋯-valikkoon, joten
näkymästä ei enää näkynyt, että se on worker.

Huomattu tuotannosta: puhelimella `components.css` sisentää otsikkorivin
kelluvan valikkopainikkeen kohdalta olettaen, että otsikko on kehyksen
ensimmäinen rivi. Workerin näkymässä ensimmäinen on nauha, joten nykyisessä
`WorkerView`ssä otsikon vasemmalle jää noin 90 px tyhjää. `round.css`:n
viimeinen sääntö on korjaus, jonka toteutus tarvitsee. Puhelimen
otsikkofaktoissa (`PhoneHeaderFacts`) ei ole paikkaa PR:lle, joten kierros
piilottaa sen puhelimella otsikkorivillä.

## What the host would need

Workerin tiedot tulevat kahdesta sopimuksesta:
`contracts/v1/spinoffs.schema.json` (runit ja valitun workerin
`transcripts`, enintään 200 historiamerkintää) ja
`contracts/v1/spinoff-work.schema.json` (Git ja PR, luetaan pyydettäessä).

Jo saatavilla:

- Haarat ja run: `branch`, `source_branch`, `worktree`, `run_id`,
  `harness`, `profile`, `state` (spinoffs).
- Gitin yhteenveto: `dirty_count`, `ahead`/`behind` lähtöhaaraan,
  `added`/`removed`, `git: available|unavailable` (spinoff-work). Riittää
  painikkeen lukuihin ja "?"-tilaan.
- PR: numero, tila, URL ja tarkistukset (spinoff-work,
  `pull_request_state` kertoo myös `unknown`/`unsupported`).
- Malli: historiamerkinnän `model` jokaisessa assistentin vastauksessa,
  sekä Pi- että Claude Code -workerilla (`spinoff_history_linux.go`).
  Ajattelutaso vain Pi:llä (`thinking_level_change`).
- Kontekstin täyttö Pi-workerilla: merkinnän `context_tokens` (Pi:n
  istunnon `usage`), ikkuna ja tiivistysvara selaimen Pi-mallikatalogista,
  kuten keskustelussa (`web/src/app/contextUsage.ts`).

Tarvitsisi uutta hostilta:

- Kontekstin täyttö Claude Code -workerilla: daemon lukee Clauden
  istunnosta nyt vain `message.model`- ja `content`-kentät. Sen pitäisi
  lukea myös `message.usage` ja täyttää `context_tokens`, ja ikkunan koko
  pitäisi saada Claude-mallille (Pi-katalogin anthropic-mallit tai oma
  tieto). Kierros näyttää Claude-workerin renkaan tavoitetilana.
- Workerin muuttuneiden tiedostojen lista ja commitit Git-kerrokseen:
  spinoff-work antaa vain luvut. Tarvitaan workerin työpuun Git-havainto
  (`workspace-git.schema.json`:n muotoinen) run-ID:llä, koska worktree ei
  ole työtila. Daemon lukee sen omana käyttäjänä samalla rajauksella kuin
  spinoff-work.
- spinoff-work luetaan nyt vain, kun kokeellinen workeririvin lause on
  päällä. Painikkeet tarvitsevat sen aina, kun workerin näkymä on auki
  (yhdelle runille, ei koko paneelille).

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-13-worker-header/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-13-worker-header/check.mjs \
  design-system/prototypes/dist/worker-header/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Tarkistus: 407 tarkistusta, konsoli puhdas.
