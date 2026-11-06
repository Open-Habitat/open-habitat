# Keskustelun konteksti – kierros 2

Issue `proto-conversation-context-view`. Jari (6.11.) valitsi kierroksen 1
(`2026-11-06-kontekstinakyma/`) suunnan **B Koko**, mutta sen ohjaimet
lupasivat sellaista, mitä Pi ei tee: yksittäisen kohteen poistoa
kontekstista. Tämä kierros käyttää vain toimintoja, jotka ovat olemassa tai
rakennettavissa Pi:n omilla mekanismeilla (tutkimus: issuen `result.md`,
kierros 2). Kolme riffiä B:stä; jokaisessa on suodatin **Vain tiedostot**.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `AgentHeader`, `ContextRing`, `ContextPage`,
`ConversationTimeline`, `AgentTurn`, `PiToolUse`, `BashToolCard`,
`FileToolCard`, `Composer`, `Segmented`, `ControlButton`, `TextArea`).
Riffin osio tulee tuotannon `ContextPage`-sivulle heti yläosan jälkeen,
kuten kierroksella 1. Kaikki on synteettistä: Contoso, Aino Virtanen, Keskon
viikkoraportti, 16 vuoroa, yksi tiivistys.

## Akseli ja riffit

Akseli: miten ohjaus tarjotaan, kun ainoat todelliset keinot ovat Pi:n
tiivistys ohjeella, uudelleenluvun pyyntö ja palaaminen aiempaan kohtaan.

- **Nyt**: tuotannon Konteksti-sivu renkaasta: osat, tiivistykset ja vuorot. Ei tiedostolistaa eikä ohjausta.
- **B1 Ennuste**: jokaisella osalla on sarake "Jos tiivistät nyt" (tiivistyy, säilyy, osin), ja ainoa ohjaus on listan alla Tiivistä nyt vapaalla ohjeella.
- **B2 Ohje riviltä**: seuraavaksi tiivistyvillä riveillä on Mainitse ja Ohita, jotka kirjoittavat yhteenvedon ohjetta listan yllä olevaan laatikkoon; säilyvillä riveillä ei ole nappeja.
- **B3 Raja**: lista on jaettu Pi:n tiivistysrajalla (tiivistyy seuraavaksi, säilyy, aina mukana, jo tiivistetty). Säilyvältä riviltä voi palata keskustelussa sitä edeltävään kohtaan.

Suositus: **B3 Raja** (result.md).

## Sama kaikissa riffeissä

- Konteksti 124 900 / 200 000 tokenia (62 %), automaattinen tiivistys yli
  183 616. Tiivistys 1 klo 10.21 korvasi vuorot 1–7.
- Rivin koko on Pi:n oma arvio (merkit / 4) sen työkalutulosteista niissä
  vuoroissa, jotka malli vielä näkee.
- **Vain tiedostot** näyttää kaikki tiedostot, jotka agentti luki tai muutti
  tällä haaralla, myös vain tiivistelmässä olevat. Pi:n `read`-, `write`- ja
  `edit`-kutsut ovat varmoja; "komennolla" tarkoittaa tunnettua lukukomentoa
  (`docx2txt`, `pdftotext`, `xlsx2csv`). Skriptin kirjoittamaa tiedostoa
  (`make_report.py --out …vko 45.docx`) ei tunnisteta muutetuksi.
- **Tiivistä nyt** on Pi:n RPC `compact` ohjeella. Pi valitsee rajan itse
  (uusimmat noin 20 000 tokenia säilyvät); vahvistus näyttää, mitkä vuorot
  tiivistyvät ja mitkä kohteet säilyvät. Heti tiivistyksen jälkeen Pi
  kieltäytyy uudesta ("Already compacted"), joten ennuste ja nappi
  poistuvat.
- **Lue uudelleen** vain kirjoittaa pyynnön viestikenttään. **Avaa** avaa
  tekstitiedoston työtilan editoriin.

## Yläpalkin ohjaimet

- *Teema*: Vaalea / Tumma.
- *Alusta* palauttaa tarinan alkuun: ei ohjetta, ei tiivistystä, ei paluuta.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-kontekstinakyma-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-kontekstinakyma-2/check.mjs \
  design-system/prototypes/dist/kontekstinakyma-2/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen riffin läpi 1440 ja 390 px
vaaleana: oletus, Vain tiedostot, ja riffin ohjaus (B1 ohje ja tiivistys;
B2 kaksi merkintää, tiivistysikkuna ja tiivistys; B3 paluu ennen vuoroa 15
ja tiivistys omalla ohjekentällä). Oletukset myös tummana. Kuvat
kertoimella 2, nimet `r2-<riffi>-<vaihe>-<leveys>-<teema>`. `index.html` on
sama ilman upotettuja fontteja glasspadia varten.
