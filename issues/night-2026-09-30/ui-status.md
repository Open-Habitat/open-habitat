# night:ui — status

Kirjoittaja: `night:ui`-kapellimestari. Lue `rest-status.md` jokaisen
kierroksen alussa. Uusin merkintä ylimmäksi.

## Pyynnöt toiselle

- **rest (19:40, estää UI-kaistan): positiivinen "päättynyt / jatkettavissa"
  -havainto yksityiseen `GET /api/v1/conversations/{id}/status`-vastaukseen.**
  Nyt sekä reapattu lapsi että elävä lapsi, jonka RPC-tulos on epävarma,
  näkyvät `state: uncertain`, eikä `native_history: readable` todista
  kirjoittajan poistumista. Selain ei siksi voi tarjota Jatka-toimintoa vain
  päättyneelle keskustelulle (`docs/ui.md`). Tarkka pyyntö:
  haaran `wt/carjf7mny9-continue-ended-conversation`
  `issues/continue-ended-conversation/result.md`, kohta "Blocking server
  request and deviation". Kun tämä on laskeutunut, kirjaa se
  `rest-status.md`:hen; UI harvestoi säilötyn työn uudella ajolla.

- **rest (18:55):** keskustelunäkymä tarvitsisi hostilta validoidun saapuvan
  kysymyksen / vastauksen, vuoron asettumisen aikaleiman ja lähetyksen
  vastaanottokuittauksen (`issues/fit-conversation-v2/`). Ei kiireellinen
  yöllä; kirjaa `build-agent-control`iin, jos se sopii sen laajuuteen.

## Kierrokset

### Kierros 1 — välitila 2026-09-30 19:40 UTC

- `continue-ended-conversation` (run `01m3stctd4k9v46ccarjf7mny9`) pysähtyi
  tarkoituksella, ei yhdistetty: 6 committia säilötty haaraan
  `wt/carjf7mny9-continue-ended-conversation`, full gate vihreä
  `30767c0`:ssa, mutta hyväksymisehto "vain päättyneelle" vaatii hostin
  signaalin (pyyntö yllä). Säilötty työ pitää UI-tokenit, joten
  `design-v2`-kaista on pysähdyksissä, kunnes signaali laskeutuu ja työ
  harvestoidaan.


- Laskeutui: `fit-conversation-v2` (run `01m3srsgsnvpbcq0td0gqhw99z`,
  `7b1cdde`…`ae57134`, full gate vihreä, 28 parikuvaa). Avoin: kysymys-,
  vuoron valmistumis- ja lähetyskuittausdata puuttuu hostilta; UI näyttää
  rehellisesti vain sen, mitä näyttömalli tukee.
- `rest`in jatka-pyyntö otettu: uusi issue `continue-ended-conversation`
  (design-v2, ennen sivupalkkia). Käynnissä run `01m3stctd4k9v46ccarjf7mny9`,
  samat UI-tokenit.
- `fit-onboarding-v2` ei etene yöllä (esto `show-large-clone-progress`,
  Jarin päätös). `compare-v2-pairs`in esto siitä poistettu; vertailu kattaa
  sovitetut viipaleet.


- Laskeutui: `recut-ui-foundation` (run `01m3snh7d7h09z82c50ztraq9h`,
  commitit `1c68735`…`9169f8b`, full gate vihreä). Komponenttikartta ja
  parikuvat: `issues/recut-ui-foundation/`. Jarille aamulla: visuaalinen
  suunta ja `component-map.md`.
- Käynnissä: run `01m3srsgsnvpbcq0td0gqhw99z`, issue `fit-conversation-v2`,
  samat tokenit kuin edellä (`design-system/`, `web/src/components/`,
  `web/src/components/Conversation.tsx`, `web/src/app/App.tsx`).

### Kierros 1 — alku 2026-09-30 17:40 UTC

- Kirjattu `review-browser-design-v2`:n Decisions-osioon yön väliaikaiset
  valinnat (puhelin mukana, v2-mitoitus tokenien lähteenä).
- Luotu kaista `design-v2`: `recut-ui-foundation` (1), `fit-conversation-v2` (2),
  `fit-sidebar-v2` (3), `fit-onboarding-v2` (4, odottaa myös
  `show-large-clone-progress`ia), `fit-account-and-history-v2` (5),
  `compare-v2-pairs` (6). Commit `01b57b0`.
- Käynnissä: run `01m3snh7d7h09z82c50ztraq9h`, issue `recut-ui-foundation`,
  törmäystokenit `design-system/`, `web/src/components/`,
  `web/src/components/Conversation.tsx`, `web/src/app/App.tsx`.
  Selaintestit `NAH_PORT_BASE=21000`.
- Pyyntö `rest`ille: `build-agent-control` jakaa tokenit `design-system/` ja
  `Conversation.tsx`, joten se odottaa tämän ajon laskeutumista.
