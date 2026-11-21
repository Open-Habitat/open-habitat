# Asetukset › Tili › Ohjeet agentille

Issue `new-user-agent-instructions-template` (Jari 21.11.2026: vanhat tilit
voivat jatkaa ohjeiden kirjoittamista missä tahansa keskustelussa, ja
Asetuksiin tarvitaan näkymä Tili › Ohjeet agentille). Suunnat, suositus ja
kysymykset Jarille ovat issuen `result-settings.md`:ssä.

Akseli: **miten ohjeet näytetään ja muutetaan ensimmäisessä näkymässä.**

- **A Luku** (suositus): tiedosto luettavana tekstinä (tuotannon
  `Markdown`) ja yksi painike, Muokkaa agentin kanssa.
- **B Teksti**: tiedosto sellaisenaan tasalevyisenä, ja painikkeet Muokkaa
  agentin kanssa ja Muokkaa tekstinä. Tekstinä muokkaus avaa tiedoston
  paikallaan tekstikenttään (Tallenna, Peru).
- **C Osiot**: ohjeet pohjan osioina riveinä (Kuka olen, Kieli, Miten
  vastaat, Kysy ensin, Muuta). Jokaisella rivillä on Muuta tai Lisää, joka
  avaa agentin keskustelun juuri siitä osiosta. Koko tiedoston saa auki.

Kaikissa suunnissa sama lähdeosa: polku `~/.pi/agent/AGENTS.md`, "Pi lukee
tämän tiedoston", lukeeko Claude sen (`~/.claude/CLAUDE.md`:n tuontirivi),
muokkauspäivä ja tarvittaessa "Päivitetty juuri". Alla rivi "Voit myös sanoa
agentille missä tahansa keskustelussa".

Tilanteet (valinta **Tilanne**, `?s=habitat|missing|own`):

- **Käyttöönotossa kirjoitetut**: kierroksen 2 pohjan mukainen tiedosto,
  Claude tuo sen.
- **Ei vielä ohjeita**: tyhjä tila ("Agentti kysyy pari asiaa ja kirjoittaa
  ne"); A:ssa ja C:ssä Kirjoita agentin kanssa, B:ssä myös Kirjoita itse. C
  näyttää osiot tyhjinä.
- **Itse kirjoitetut**: ihmisen oma tiedosto ilman pohjan osioita, ja
  Clauden tiedostossa on omia ohjeita ilman tuontia. Näkymä kertoo, ettei
  Claude lue ohjeita ja ettei agentti kirjoita oman tekstin päälle. C ei
  pysty jäsentämään tiedostoa ja näyttää sen sellaisenaan.

Muokkaa agentin kanssa avaa uuden keskustelun kotihakemistossa (`Koti`,
otsikko Ohjeet agentille). Agentti on lukenut tiedoston, ja pikavastaukset
ehdottavat tavallisia muutoksia. Ehdotus näkyy muutoksena (`+` ja `−`).
Tallenna näyttää tuotannon tool-rivin (`edit`, uudelle tiedostolle `write`
kummallekin tiedostolle), ja Takaisin asetuksiin palaa päivittyneeseen
näkymään. Itse kirjoitettuun tiedostoon agentti vain lisää. Pikavastaus
Lisää viittaus Claudelle lisää tuontirivin Clauden tiedoston alkuun.

## Käyttö

```
node build.mjs <out-dir>                                   # offline.html ja index.html
node check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

`build.mjs` tarvitsee `web/node_modules`-hakemiston (`npm ci` hakemistossa
`web/`) ja `check.mjs` lisäksi Playwrightin Chromiumin
(`PLAYWRIGHT_BROWSERS_PATH`). Tarkistus: 551 tarkistusta, konsoli puhdas.
`?theme=dark`, `?lang=en` ja `?s=…` valitsevat alkutilan.

## Rakenne

Sivu on tuotannon `AppShell`, `WorkspaceRail` ja `AccountSettings`
Tili-osiossa. Kierros lisää ladattaessa tuotannon asetushakemistoon
(`shownSettingsSections`) Tilin riviksi `agent-instructions`, joten haku
tuntee sen. Lohko viedään portaalilla `.s-main`iin Tilin kortin jälkeen ja
palvelinversion rivin edelle. Tilin tuotantorivit saavat synteettiset
vastaukset (`git-identity`, `view-addresses` 204). Keskustelu koostuu
tuotannon osista: `ConversationFrame`, `AgentHeader`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`Markdown` ja `Composer`. Kierroksen omia ovat lohkon kolme runkoa,
lähdeosa, ehdotuskortti ja pikavastaukset. Kirjastoon (`lib/`) ja
tuotantokoodiin ei tehty muutoksia.
