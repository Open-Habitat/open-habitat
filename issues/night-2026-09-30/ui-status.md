# night:ui — status

Kirjoittaja: `night:ui`-kapellimestari. Lue `rest-status.md` jokaisen
kierroksen alussa. Uusin merkintä ylimmäksi.

## Pyynnöt toiselle

- **rest (23:20, ei kiireellinen):** synteettinen fake-Pi
  (`test/browser-host/fakepi.go`) voisi tuottaa korreloidut `tool_call_id`t
  ja viivästetyt tekstideltat, jotta lab-testi todistaisi natiivin
  julkaisun oikean controllerin läpi. Tarkemmin
  `issues/stream-conversation-events/result.md`.

- **rest (21:20, ei kiireellinen):** tilinäyttöpäätöksen
  (`decide-account-display`) mukainen varmennettu etunimi ja kirjautunut
  sähköposti selainsopimukseen pelkkinä näyttökenttinä. Ilman niitä UI
  näyttää "Oma tili". Sopii myös aamun Jari-päätökseksi, jos lähde on auki.

- ~~**rest (19:40, estää UI-kaistan): positiivinen "päättynyt / jatkettavissa"
  -havainto yksityiseen `GET /api/v1/conversations/{id}/status`-vastaukseen.**
  Nyt sekä reapattu lapsi että elävä lapsi, jonka RPC-tulos on epävarma,
  näkyvät `state: uncertain`, eikä `native_history: readable` todista
  kirjoittajan poistumista. Selain ei siksi voi tarjota Jatka-toimintoa vain
  päättyneelle keskustelulle (`docs/ui.md`). Tarkka pyyntö:
  haaran `wt/carjf7mny9-continue-ended-conversation`
  `issues/continue-ended-conversation/result.md`, kohta "Blocking server
  request and deviation". Kun tämä on laskeutunut, kirjaa se
  `rest-status.md`:hen; UI harvestoi säilötyn työn uudella ajolla.~~ Hoidettu 20:10.

- **rest (18:55):** keskustelunäkymä tarvitsisi hostilta validoidun saapuvan
  kysymyksen / vastauksen, vuoron asettumisen aikaleiman ja lähetyksen
  vastaanottokuittauksen (`issues/fit-conversation-v2/`). Ei kiireellinen
  yöllä; kirjaa `build-agent-control`iin, jos se sopii sen laajuuteen.

## Kierrokset

### Kierros 2 — välitila 2026-09-30 23:50 UTC

- Laskeutui: `show-turn-receipts` (run `01m3t9ett3vryfze190mb4hsvw`,
  …`f38942f`, full gate vihreä, issue `done`). Lähetyskuittaukset,
  natiiviavaimella rajattu "Vuoro valmis" ja kysymys pelkkänä tekstinä.
- Käynnissä: run `01m3tbajabater7c7k7ks896sq`, `fit-conversation-density-v2`
  (G3), UI-tokenit.

### Kierros 2 — välitila 2026-09-30 23:20 UTC

- Laskeutui: `stream-conversation-events` (run `01m3t5wj8a9mcmw6nnrmy4984q`,
  …`7ed6661`, full gate vihreä, issue `done`). Selain kuluttaa
  `/api/v1/events`in: `live_tail` ensin, deltat ja työkalut, aukko/409 →
  uusi snapshot, ei uudelleenlähetystä. Näyttö on synteettinen:
  selaintestit syöttävät validoitua SSE:tä, koska fake-Pi ei tuota
  työkalu-ID:itä eikä tekstideltoja (pyyntö alla).
- `rest`in 22:15-kuittaukset otettu: `show-turn-receipts` (seq 8),
  käynnissä run `01m3t9ett3vryfze190mb4hsvw`, UI-tokenit. G3–G2 siirtyivät
  seq 9–11.


- `rest`in 21:35-pyyntö otettu: `stream-conversation-events` (design-v2,
  seq 7). Käynnissä run `01m3t5wj8a9mcmw6nnrmy4984q`, UI-tokenit.
- Jonossa samalla kaistalla: `fit-conversation-density-v2` (G3),
  `fit-return-view-v2` (G1), `fit-settings-density-v2` (G2).
- Kun `rest`in vuoron asettumis-/kuittausajo laskeutuu, UI ottaa sen
  keskustelunäkymään; kirjaa kenttien nimet tänne pyyntöihin.

### Kierros 1 — valmis 2026-09-30 22:15 UTC

**Yhteenveto.** Selain-design v2:n kaista eteni kaikilta osin, jotka yöllä
voivat edetä. Kuusi omaa ajoa laskeutui (`landed: true`, git-verified), kukin
täydellä puhtaalla gatella ja riippumattomalla katselmoinnilla. Mitään ei ole
käynnissä. Deploy kuuluu `rest`ille.

**Laskeutui**
- `recut-ui-foundation` — v2-mitoitus tokeneiksi, asettelupohjat, painike-,
  tilamerkki- ja SVG-ikoniprimitiivit, mittaväitteet gatessa.
- `fit-conversation-v2` — keskustelun tilat v2:n mukaan.
- `continue-ended-conversation` — Jatka päättyneeseen selainkeskusteluun,
  vain `continuation: eligible` (harvest ensimmäisestä, tarkoituksella
  pysähtyneestä ajosta).
- `fit-sidebar-v2` — ⌂ Etusivu, suljettu kaista, puhelimen laatikko,
  tilivalikko "Oma tili" -varalla.
- `fit-account-and-history-v2` — asetukset ja paluunäkymä.
- `compare-v2-pairs` — 32 vedos/lab-paria ja luokiteltu indeksi
  (`issues/compare-v2-pairs/index.md`).

**Testattavaa (synteettinen lab):** koko selainpolku molemmissa teemoissa
ja 390 px:ssä; parikuvat yllä olevassa indeksissä.

**Päätökset Jarille**
- Yön väliaikaiset valinnat (puhelin mukana, v2-mitoitus tokenien
  lähteeksi) — `review-browser-design-v2` Decisions.
- `recut-ui-foundation/component-map.md` ja poikkeamat I1–I6
  (`compare-v2-pairs/index.md`): sopimukset voittivat vedoksen.
- Etunimen ja sähköpostin luotettava lähde (`decide-account-display`).
- Pi/OpenAI-yhteysrivi asetuksiin vaatii hostin varmennetun tilan.
- `fit-onboarding-v2` odottaa `show-large-clone-progress`in
  levykiintiöpäätöstä.
- Orpo haara `wt/carjf7mny9-continue-ended-conversation`
  (run `01m3stctd4k9v46ccarjf7mny9`, sisältö laskeutunut): `run discard`.

**Seuraavaksi (kierros 2):** selaimen `/api/v1/events`-kulutus (`rest`in
21:35-pyyntö) ja vertailun esitysaukot G1–G3.

### Kierros 1 — välitila 2026-09-30 21:50 UTC

- Laskeutui: `fit-account-and-history-v2` (run `01m3t2vksj9h2dyt6fxq75tdr7`,
  `6c580c9`…`766a29a`, full gate vihreä, issue `done`). Asetuksista puuttuu
  Pi/OpenAI-yhteysrivi, koska snapshotissa ei ole varmennettua tilaa
  (pyyntö issuessa).
- Käynnissä: run `01m3t48p660x6yj6y9wtfrk5xr`, `compare-v2-pairs`
  (vedos vs. lab -parit, ei tuotekoodimuutoksia), samat UI-tokenit.

### Kierros 1 — välitila 2026-09-30 21:20 UTC

- Laskeutui: `fit-sidebar-v2` (run `01m3t0bzwtn2sxngjgds90wqqx`,
  …`ff8f843`, full gate vihreä, issue `done`). Tilipainike käyttää
  "Oma tili" -varaa, koska varmennettua etunimeä ja sähköpostia ei ole
  selainsopimuksessa; suljetun kaistan + ei avaa valitsinta ennen kuin
  sellainen on. Poikkeamat: `issues/fit-sidebar-v2/item.md`.
- Käynnissä: run `01m3t2vksj9h2dyt6fxq75tdr7`,
  `fit-account-and-history-v2`, samat UI-tokenit.

### Kierros 1 — välitila 2026-09-30 20:40 UTC

- Laskeutui: `continue-ended-conversation` (harvest-run
  `01m3sz52ad035a8n79390m4th1`, `3467b8c`…`1c82eba`, full gate vihreä,
  issue `done`). Jatka näkyy vain `continuation: eligible` -tilassa.
  Ensimmäisen ajon `01m3stctd4k9v46ccarjf7mny9` haara
  `wt/carjf7mny9-continue-ended-conversation` on nyt orpo (sisältö
  laskeutunut, `landed: true`); poisto on Jarin
  `taskfleet run discard` -päätös.
- Käynnissä: run `01m3t0bzwtn2sxngjgds90wqqx`, `fit-sidebar-v2`, samat
  UI-tokenit.

### Kierros 1 — välitila 2026-09-30 20:15 UTC

- `rest`in `continuation`-havainto laskeutui; kiitos. Harvest-ajo
  `01m3sz52ad035a8n79390m4th1` (`continue-ended-conversation`) ottaa
  säilötyt commitit ja rajaa Jatka-toiminnon arvoon `eligible`. Samat
  UI-tokenit.

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
