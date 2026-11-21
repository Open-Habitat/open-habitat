# Päätteen asetukset – kierros 2

Jari 21.11.2026 valitsi kierroksen 1 suunnan C (Asetukset › Pääte ja elävä
esikatselu, paneelin ratas vie sinne) kahdella muutoksella: paneelin ratas
vain avaa Asetukset-sivun eikä paneelissa ole asetuksia, ja tekstin koko
tarvitsee esikatselun. Issue `terminal-settings-page`; suunnat, suositus ja
kysymykset ovat issuen `result-2.md`:ssä.

Näkymiä on yksi, Asetukset › Pääte. Akseli: **miten tekstin koko valitaan ja
esikatsellaan.**

- **A Liukusäädin**: 10–18 px puolen pikselin askelin, arvo oikealla, ja
  suoraan alla elävä pääte vaihtaa kokoa vetäessä. Esikatselun kulmassa
  siru "141 saraketta".
- **B Askelin**: − 12,5 px + ja Oletus. Esikatselun yllä sarakeviivain, joka
  on kohdistettu xtermin omiin soluihin, ja katkoviiva sarakkeen 80 kohdalla,
  kun esikatselu on sitä leveämpi. Alla lause: "Päätepaneeliin mahtuu tällä
  näytöllä N saraketta", ja alle 80:n kohdalla varoitus rivittymisestä.
- **C Valmiit koot**: Pieni, Normaali, Iso ja Suurin korttiradiona, jokaisessa
  pienoiskuva oikeassa koossa ja paneeliin mahtuvat sarakkeet; valittu koko
  näkyy elävässä esikatselussa.

Sarakemäärä on tämän näytön päätepaneelin, ei esikatselun: pääalueen leveys
miinus xtermin vierityspalkki jaettuna sillä solun leveydellä, jonka
piilotettu xterm saa samassa koossa. `check.mjs` vertaa lukua paneelin omiin
sarakkeisiin, ja ne ovat samat. Luku seuraa selaimen omaa fonttimetriikkaa:
headless-Linux pyöristää JetBrains Monon kokonaisiin pikseleihin, joten
siellä 12,5 ja 14 px voivat antaa saman sarakemäärän; Macissa ne eroavat.

Esikatselu on kiinnitetty alkuunsa, jotta komento ja pitkä, rivittyvä
`alarm_test.go`-rivi näkyvät koosta riippumatta. Oletuskoko on työpöydällä
12,5 px ja puhelimessa 12 px; koko on selainkohtainen.

Muu sisältö on kierroksen 1 C: Kopioi valitsemalla (Pois/Päällä, oletus Pois,
on jo olemassa), Kohdistin ja Usean rivin liittäminen (Ehdotus), "Näin pääte
toimii" ja asetushaku. Paneelissa on vain ratas suurennuspainikkeen edessä;
se avaa Asetukset › Pääte, jonka alussa on "Takaisin päätteeseen", ja myös
Asetusten sulkeminen palaa päätteeseen.

Sivu on tuotannon `AppShell`, `WorkspaceRail`, `AccountSettings`,
`TerminalPanel`, `UserMessage`/`AssistantMessage`, `Segmented`,
`ControlButton` ja `IconButton`. Pääte on xterm.js tokeneilla kuten tuotannon
`TerminalSurface`. Palvelinta ei ole; kopiot kirjautuvat `window.__copies`iin
ja liitokset `window.__pastes`iin. Kirjastoon (`lib/`) ja tuotantokoodiin ei
tehty muutoksia.

Katselmointipalkki: Näkymä (Asetukset › Pääte / Työtila ja pääte), teema,
kieli, "Liitä 3 riviä" (työtilassa) ja Alusta. `?view=`, `?theme=` ja
`?lang=en` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-terminal-settings-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-21-terminal-settings-2/check.mjs \
  design-system/prototypes/dist/terminal-settings-2/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/terminal-settings-2/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa. `--quick` ajaa vain 1440 px:n
Päivä-teeman.
