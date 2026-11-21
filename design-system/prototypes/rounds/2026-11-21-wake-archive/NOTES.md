# Arkistointi, kun herätys odottaa – ajastetun herätyksen kierros 2

- **1 Rivillä**: arkistointipainikkeen paikalle avautuu pieni vahvistus
  (`Herätys to 9.00 perutaan.` · Arkistoi · Älä arkistoi): rivin sisään
  sivupalkissa, yläpalkin alle keskustelussa. Ei ikkunaa.
- **2 Ikkuna**: vahvistusikkuna, joka nimeää jokaisen herätyksen ajan,
  asettajan ja muistiinpanon ja kertoo, ettei myöhempi palautus tuo niitä
  takaisin. Sama ikkuna kuin tuotannon avustajien arkistointivahvistus.
- **3 Heti**: arkistoi kysymättä kuten nyt; tuotannon ilmoitus kertoo
  `herätys to 9.00 peruttu`, ja sen Palauta tuo myös herätyksen takaisin.

Issue `scheduled-wake`. Suunnat, suositus ja kysymykset Jarille ovat
issuen `result-archive.md`:ssä. Kierros 1 (`2026-11-17-scheduled-wake`)
on hyväksytyn suunnan 1 Aika rivillä lähde.

Sivu koostuu tuotannon osista: `AppShell` ilmoitusalueineen,
`WorkspaceRail`, `NowSections`in osiomerkintä, `AgentNavItem` ja
`QuietSection` omine arkistointipainikkeineen (`RailArchive`),
`AgentHeader` oikeine arkistointikontrolleineen (puhelimessa se on
yläpalkin valikossa), `ArchiveNotice` Palauta-painikkeineen,
`ArchivedFoot`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`ToolRow` sekä avustajien vahvistusikkunan rakenne ja tyylit
(`HelperArchive.css`, react-aria `ModalOverlay`/`Modal`/`Dialog`).
Kierroksen omia ovat kolme vahvistusta, kierroksen 1 herätysaika rivillä
(`data-wake` tuotannon rivin `time.ah-nav-time`-elementissä), odottavan
herätyksen rivi vastauksen alla ilman Muuta/Peru-painikkeita, sekä Open
Habitatin rivi, joka kertoo perutut herätykset ja palautuksen jälkeen
sen, mitä agentti kuulee.

Maailma on ti 17.11. klo 15.20. Varakopion poisto (henkilön pyytämä
herätys to 19.11. 9.00, auki), Tilauksen seuranta (agentin oma seuranta
ke 18.11. 14.00), Vuokrasopimuksen irtisanominen (kaksi herätystä: 1.12.
10.00 henkilön ja 4.1.2027 9.00 agentin) ja Kuittien nimeäminen
(hiljainen ilman herätystä: arkistoituu kysymättä kaikissa suunnissa).
Vertailuksi käynnissä oleva ja vastattava keskustelu, joita ei voi
arkistoida tai joilla ei ole herätystä. Alkutila palauttaa kaiken.
`?theme=light|dark|contrast` ja `?lang=en` valitsevat alkutilan.

Tuotannossa avoimen keskustelun arkistointi yläpalkista siirtää työtilan
sivulle. Kierros jää keskusteluun ja näyttää sen arkistoituna
(`ArchivedFoot`), jotta Open Habitatin rivi ja myöhempi palautus näkyvät
samassa näkymässä; ilmoitus ja sen Palauta ovat samat kuin tuotannossa.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-wake-archive/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-21-wake-archive/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` defaults to `design-system/prototypes/dist/wake-archive`.
`web/node_modules` must match the lockfile (`npm ci --prefix web`). The
build's `undefined-composes-from` warnings come from production's
`Controls.module.css` and are not this round's. Check: 640 checks, clean
console, at 1440 and 390 px in Päivä, Yö and Kontrasti (flows in Päivä and
Yö), plus English on desktop and phone.
