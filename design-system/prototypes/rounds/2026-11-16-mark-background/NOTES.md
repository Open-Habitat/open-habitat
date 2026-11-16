# Taustatyö Open Habitat -merkissä – kierros 1

- **Nyt**: tuotanto tänään. Merkki näyttää vain keskustelun tilan. Piste rivin lopussa (`ah-nav-service`) kertoo palvelusta, joka jätettiin käyntiin ennen viimeisintä vastausta. Herättämätön prosessi ei näy missään.
- **1 Lamppu**: pieni liikkumaton lamppu merkin oikeassa alakulmassa aina, kun keskustelulla on prosessi käynnissä, tilasta riippumatta. Piste jää pois.
- **2 Vaeltava ovi**: ovi kiertää hitaasti kaikissa tiloissa kuten tuotannon Odottaa taustatyötä -tilassa. Valmiin keskustelun ovi on raollaan. Piste jää.
- **3 Takahuone**: merkin taakse piirtyy toinen huone, josta näkyvät oikea ja alareuna. Piste jää.

Issue `mark-hides-background-work`. Suunnat, suositus ja Jarin kysymykset
ovat issuen `result.md`:ssä.

Sivu koostuu pelkästään tuotannon osista: `AppShell`, `WorkspaceRail`,
`NowSections`in osiomerkintä, `AgentNavItem` (oma `RowMark` ja
`ah-nav-service`-piste) ja `QuietSection`. Kierroksella ei ole omaa riviä.
Kierros asettaa `data-bg`-attribuutin riveille, joiden keskustelulla on
prosessi käynnissä, ja `round.css` piirtää suunnan merkin tuotannon merkin
päälle (`.ah-row-mark-hit`in pseudoelementit, suunnassa 2 renkaan
`stroke-dash*`). Oikealla oleva tarina (prosessit, mitä host niistä
tänään kertoo, tapahtumat ja puhelinhuomio) on katselmoinnin apu eikä
ehdotus käyttöliittymäksi.

Tilanteet ovat samat kaikissa suunnissa. Käynnissä-osiossa on
`Karttatasojen välimuisti`, jonka vuoro on käynnissä ja aiemmin jätetty
`npm run dev` pyörii. `Reittihaun suorituskyky` odottaa `npm run bench`iä,
jonka herätys on päällä, joten sillä on tuotannon background-merkki.
Sinun vuorosi -osiossa on `Etusivun uusi ulkoasu`, jonka lukematon vastaus
jätti `python3 -m http.server 8080`:n käyntiin, ja `Yhteydenottolomake`,
jonka luetun vastauksen taustalla on `vite --port 5174`; tästä tapauksesta
raportti alun perin tuli. Hiljaisissa on `Kuukausiraportin ajastus`,
jossa `sleep 900` pyörii ilman herätystä ja jonka vastaukselle sanottiin
Ei nyt. Lisäksi kolmella keskustelulla ei ole prosesseja vertailun vuoksi.
Tapahtumat: luet etusivun vastauksen (merkki jää), raportin sleep päättyy
(merkki sammuu). `?theme=light|dark|contrast`, `?lang=en` ja
`?motion=reduced` valitsevat alkutilan; yläpalkin Liike: vähennetty
jäljittelee `prefers-reduced-motion`ia tuotannon pysäytyskuvilla.

## What the host would need

- **Every running process, not only waking ones.** `inventoryWaiting`
  (`internal/daemon/processes_linux.go`) drops processes whose `Wakes` is
  false, so `waiting_on` never carries a `sleep` started with notify
  `ignore`. All three directions need those processes too, marked as not
  waking: a `wakes: false` on the waiting entry, or a separate list of the
  conversation's running processes. `waitedFor` must treat a non-waking
  process as a service, never as waited for. That is a contract change
  (`contracts/v1/`) and stays inside the daemon's existing inventory
  query, with no new authority.
- **Also while a turn runs.** The snapshot sets `waiting_on` only when
  `!active.runActive && questionID == ""`. The working row with a dev
  server (`Karttatasojen välimuisti`) and a row with a pending question
  need the list to show the sign. Without it the sign flickers off for
  every turn.
- **railNow and the row.** railNow already computes `services` (gated by
  `observed.running`). The row needs one boolean, "a process of this
  conversation runs", passed by `AgentNavItem` to `RowMark` and on to
  `HabitatMark` as a prop (`lamp`) that draws an SVG circle in the mark's
  own viewBox (about `cx=10.4 cy=10.4 r=2.4`, outside the ring box) instead
  of this round's pseudo-element. The row's description already says
  "Taustalla käynnissä: …"; with direction 1 the `ah-nav-service` element
  goes, and its words stay in the description.
- Direction 2 needs only the boolean and the CSS for `[data-bg]`.
  Direction 3 needs the same as 1, drawn as a path.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-16-mark-background/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-16-mark-background/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` defaults to `design-system/prototypes/dist/mark-background`.
`web/node_modules` must match the lockfile (`npm ci --prefix web`). The
build's `undefined-composes-from` warnings come from production's
`Controls.module.css` and are not this round's. Check: 842 checks, clean
console. The 4x `marks-*.png` crops show the marks at a readable size.
