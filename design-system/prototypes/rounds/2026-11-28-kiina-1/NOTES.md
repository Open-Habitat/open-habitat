# Kiinankielinen käyttöliittymä – kierros 1

Issue `chinese-interface`. Koodisuunnitelma on issuen `design.md`:ssä,
päätökset ja kysymykset `result.md`:n kohdassa "Kierros 1".

Tuotannon näkymät yksinkertaistetulla kiinalla: sivupalkki, keskustelu
kenttineen, tilivalikko, Asetukset › Ulkoasu kielivalintoineen, Asetukset ›
Tili, käyttöönoton repojen valinta ja uloskirjautumisen ikkuna. Komponentit
ovat tuotannon, muuttamattomia: `AppShell`, `WorkspaceRail`, `NowSections`,
`WorkspaceNavRow`, `AccountShelf`, `AgentHeader`, `ConversationFrame`,
`ConversationTimeline`, `UserMessage`, `AgentTurn`, `ToolRow`, `Markdown`,
`Composer`, `AccountSettings`, `AccountLogoutDialog`, `GitHubRepoChooser`
ja `OnboardingFrame`.

Tekstit tulevat tuotannon luetteloista. `build.mjs` liittää jokaiseen
luetteloon `zh-CN`-kohdan tiedostosta `zh/<moduuli>.ts` (sama rakenne kuin
`design.md`:n ehdottama `locale()`), laajentaa `i18n/index.ts`:n kielilistat
ja lisää asetusten nimiin kiinan haaran (`settingsIndexZh.ts`). Kielirivi on
kierroksen oma (`languageSettings.tsx`), koska tuotanto luettelee kielensä
komponentissa. Käännökset ovat agentin luonnoksia vain näiden näkymien
avaimille. Avain, jota zh-tiedosto ei anna, näkyy englanniksi ja kirjautuu
`window.__zhMissing`-listaan; tarkistus vaatii listan tyhjäksi. zh-TW-valinta
vaihtaa sivun kielen ja fonttipinon, mutta tekstit ovat zh-CN:n, koska
zh-TW-luetteloa ei vedoksessa ole.

Valitsimen akseli on se, mistä kiinan merkit tulevat:
**A · Nyt** (tuotannon pino sellaisenaan), **B · Pino** (nimetty CJK-pino
kielittäin ja kiinan säännöt), **C · Fontti** (B:n säännöt ja upotettu Noto
Sans SC). C:n fontti haetaan kerran `npm pack @fontsource/noto-sans-sc`
-komennolla hakemistoon `dist/kiina-fonts` (ei versionhallinnassa), ja
rakennus upottaa vain ne palat, joissa on kierroksen tekstien merkkejä.

URL: `?v=` suunta (1–3), `?s=` tilanne (`keskustelu`, `kieli`, `tili`,
`aloitus`, `ikkuna`), `?lang=zh-CN|zh-TW|fi|en-US`, `?theme=light|dark|contrast`.
Aika on kiinnitetty Shanghain aikavyöhykkeeseen. Henkilöt, repot ja viestit
ovat synteettisiä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # tai symlinkki päächeckoutin web/node_modulesiin
node design-system/prototypes/rounds/2026-11-28-kiina-1/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-28-kiina-1/check.mjs \
  design-system/prototypes/dist/2026-11-28-kiina-1/offline.html <kuvahakemisto> [--quick]
```

`offline.html` on yksi itsenäinen tiedosto fontteineen (C:n palat mukaan
lukien), `index.html` sama ilman upotettuja fontteja. `check.mjs`:n alku
kertoo, mitä se tarkistaa, myös välit (adjacency): tuotannon omat, myös
suomeksi ja englanniksi näkyvät läheisyydet raportoidaan, vain kiinassa
syntyvä hylkää.
