# Päätteen asetukset – kierros 1

Jari 21.11.2026: kopiointi valitsemalla (nyt kokeellinen
`terminal-copy-on-select`) on tavalliselle käyttäjälle outo, joten siitä tulee
päätteen tavallinen asetus, oletuksena pois päältä. Sama sivu kokoaa päätteen
muut asetukset. Issue `terminal-settings-page`; suunnat, suositus ja
kysymykset ovat issuen `result.md`:ssä.

Akseli: **missä päätteen asetukset asuvat.**

- **A Osio**: Asetukset › Pääte on tavallinen osio Editorin jälkeen.
  Päätepaneeliin ei tule mitään. Oletusnäkymä on Asetukset › Pääte.
- **B Ratas**: päätepaneelin työkaluriville tulee ratas, joka avaa asetukset
  päätteen päälle (puhelimessa alalaidan levynä); muutos näkyy heti takana.
  Asetuksissa on vain viittaus rattaaseen. Oletusnäkymä on työtila ja
  rattaan valikko auki.
- **C Esikatselu**: Asetukset › Pääte kuten A, mutta osio alkaa elävällä
  esikatselupäätteellä, jossa valintaa ja kokoa voi kokeilla. Paneelin ratas
  vie tähän osioon; toista asetusnäkymää ei ole.

Sisältö on sama kaikissa: Kopioi valitsemalla (Pois/Päällä, oletus Pois; on
jo olemassa), Tekstin koko (Pieni/Normaali/Iso), Kohdistin
(Laatikko/Alaviiva/Pystyviiva) ja Usean rivin liittäminen (Kysy ensin/Liitä
heti). Kolme jälkimmäistä on merkitty Ehdotukseksi: kukin on yksi xtermin
asetus tai `BrowserShell`in olemassa oleva haara. Alla "Näin pääte toimii"
kertoo, mitä pääte tekee jo ilman asetusta: värit seuraavat Ulkoasun teemaa
(linkki Ulkoasuun toimii), osoitekortti, rulla selaa tmuxin historiaa
(`history-limit`) ja Shift valitsee, kun ohjelma käyttää hiirtä.
Asetushakuun lisätään Pääte-osion rivit, ja Kokeellisista poistuvat
kopioinnin ja osoitteiden rivit.

Sivu on tuotannon `AppShell`, `WorkspaceRail`, `AccountSettings`,
`TerminalPanel`, `UserMessage`/`AssistantMessage` ja `Segmented`. Osio viedään
portaalilla `.s-main`iin ja ratas paneelin `.ah-terminal-tools`iin
suurennuspainikkeen eteen. Pääte on xterm.js tokeneilla kuten tuotannon
`TerminalSurface` (värit kopioitu sen `tokenTheme`stä), koska tuotannon
pinnalla ei vielä ole koon eikä kohdistimen asetusta. Palvelinta ei ole:
tuloste kirjoitetaan kerran, kopiot kirjautuvat `window.__copies`iin ja
liitokset `window.__pastes`iin. Kirjastoon (`lib/`) ja tuotantokoodiin ei
tehty muutoksia.

Katselmointipalkki: Näkymä (Asetukset › Pääte / Työtila ja pääte), teema,
kieli, "Liitä 3 riviä" (työtilassa) ja Alusta. `?view=`, `?theme=`,
`?lang=en` ja `?gear=closed` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-terminal-settings/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-21-terminal-settings/check.mjs \
  design-system/prototypes/dist/terminal-settings/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/terminal-settings/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa; vedot päätteessä tehdään
oikealla hiirellä. `--quick` ajaa vain 1440 px:n Päivä-teeman.
