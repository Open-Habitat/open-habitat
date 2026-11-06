# Keskustelun konteksti – kierros 1

Issue `proto-conversation-context-view`. Jari (6.11.) piti kierroksen
`2026-11-06-m365-selaus` suunnan C tilalokista ("mitä agentti luki ja muutti
tässä keskustelussa") ja halusi laajentaa sen nykyisen kontekstin
analyysinäkymäksi. Kierros on rakennettu tuotannon komponenteista
(`AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`, `ContextRing`,
`ContextPage`, `ConversationTimeline`, `AgentTurn`, `PiToolUse`,
`BashToolCard`, `FileToolCard`, `Composer`, `ViewSplit`, `Segmented`,
`ControlButton`). B ja C lisäävät oman osionsa tuotannon `ContextPage`-sivulle
heti sen yläosan (koko, palkki, tila ennen tiivistystä) jälkeen; C piilottaa
sivun oman vuorotaulukon, koska aikajana korvaa sen. Kaikki on synteettistä:
Contoso, Aino Virtanen, Keskon viikkoraportti, 16 vuoroa, yksi tiivistys.

## Akseli ja suunnat

Akseli: mikä järjestää analyysin.

- **Nyt**: tuotannon Konteksti-sivu renkaasta. Osat, tiivistykset ja vuorot; luetut ja muutetut tiedostot näkyvät vain tiivistyksen kohdalla.
- **A Kohteet**: renkaasta aukeaa sivupaneeli, jossa jokainen luettu tai muutettu tiedosto, viesti ja komento on rivi: koko nyt ja onko se mallilla vai vain tiivistelmässä. Rivin voi merkitä tärkeäksi tai tarpeettomaksi ja pyytää luettavaksi uudelleen.
- **B Koko**: tuotannon sivu alkaa siitä, mihin konteksti kuluu. Jokainen luettu tiedosto ja tuloste on oma palansa palkissa ja listassa suurimmasta pienimpään; valitut voi tiivistää pois.
- **C Aikajana**: tuotannon sivu alkaa vuoroista. Jokainen vuoro näyttää, mitä se luki ja muutti ja paljonko konteksti kasvoi; tiivistyksen raja kulkee aikajanan poikki, ja vuorosta voi haarautua.

Suositus: **A Kohteet**, ja sen alalinkki vie tuotannon sivulle, johon
lisätään B:n "Mihin konteksti kuluu" -lista (result.md).

## Sama kaikissa suunnissa

- Konteksti 124 900 / 200 000 tokenia (62 %), Pi tiivistää yli 183 616.
  Tiivistys 1 klo 10.21 korvasi vuorot 1–7 yhteenvedolla.
- Kohteet: 15 tiedostoa, viestiä, kalenterimerkintää ja komentoa. Kunkin koko
  on sen työkalutulosteiden summa niissä vuoroissa, jotka agentti vielä näkee.
  Komennolla luettu (docx, pdf, sähköposti) sanotaan "Luki komennolla",
  koska se tunnistetaan komennosta eikä luku- tai kirjoituskutsusta.
- Ohjaus on Pi:n omaa: **Tiivistä nyt** ohjeella (merkinnöistä kirjoitettu
  ohje näytetään ennen vahvistusta, samoin se, mikä säilyy sellaisenaan:
  60 kassan testin tuloste 24 800 jää, koska se on uusimmissa vuoroissa),
  **pyydä lukemaan uudelleen** (viesti kenttään, agentti lukee itse) ja C:ssä
  **haaraudu vuorosta** (uusi keskustelu, vuoron viesti kenttään).
- Tiivistyksen jälkeen rengas näyttää "?" ja koko on arvio, kunnes agentti
  vastaa seuraavan kerran, kuten tuotannossa.

## Yläpalkin ohjaimet

- *Teema*: Vaalea / Tumma.
- *Alusta* palauttaa tarinan alkuun: ei merkintöjä, ei toista tiivistystä,
  ei haaraa.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-kontekstinakyma/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-kontekstinakyma/check.mjs \
  design-system/prototypes/dist/kontekstinakyma/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi 1440 ja 390 px vaaleana:
oletus; A:ssa kohteen avaus, kaksi merkintää, tiivistysikkuna ohjeineen,
tiivistys ja uudelleenluku; B:ssä suurimman osan merkintä, tiivistys ja
tiivistetyn uudelleenluku; C:ssä vuoron avaus, haarautuminen ja tiivistys
ennusterivistä. Oletukset myös tummana 1440 ja 390 px. 68 tarkistuspistettä,
konsoli puhdas, kuvat kertoimella 2. `index.html` on sama ilman upotettuja
fontteja glasspadia varten.
