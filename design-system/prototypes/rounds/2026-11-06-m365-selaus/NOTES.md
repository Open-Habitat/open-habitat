# Mitä agentti näkee Microsoft 365:ssä – kierros 1

Issue `proto-browse-what-agent-sees-m365`. Aino (Contoso, 6.11.) haluaa ensin
selata, mitä agentti näkee hänen SharePointissaan ja OneDrivessaan, ja
myöhemmin nähdä, mitä agentti on sinne tehnyt. Kierros on rakennettu
tuotannon komponenteista (`AppShell`, `WorkspaceRail`, `AgentNavItem`,
`AgentHeader`, `ConversationTimeline`, `AgentTurn`, `PiToolUse`,
`BashToolCard`, `FileToolCard`, `Composer`, `ViewSplit`, `AccountSettings`
Tiedot agenteille -osioineen ja Microsoft-tilin `AccountCard`, `StatusMark`,
`Segmented`, `LinkRow`). Tason nimet tulevat tuotannon katalogista
(`levelName`). Hostin paikalla on `fetch`-sijainen. Kierroksen omia ovat
selain (lähteet, kansiot, tiedosto), agentin merkki ja muutoslista, "Agentti
ei näe" -lista, annetun tiedoston siru ja kunkin suunnan kehys. Kaikki on
synteettistä: Contoso, Aino Virtanen, Keskon kassajärjestelmäprojekti.

## Akseli ja suunnat

Akseli: missä selaus asuu ja mistä agentin muutokset löytyvät.

- **A Asetukset**: selaus asuu Microsoft-tilin kortin alla (Asetukset › Tiedot agenteille); agentin muutokset ovat lista kortissa ja merkki tiedoston kohdalla.
- **B Tiedostot**: oma Tiedostot-näkymä sivupalkissa työtilojen yllä; kolme saraketta, Agentin muutokset -välilehti ja keskustelun vuorosta linkki muutettuun tiedostoon.
- **C Paneeli**: keskustelun sivupaneeli alkaa siitä, mitä agentti luki ja muutti tässä keskustelussa; samasta paneelista selataan ja annetaan tiedosto agentille.

Suositus: **C Paneeli**, ja siihen B:n Agentin muutokset -lista myöhemmin,
jos keskustelukohtainen näkymä ei riitä (result.md).

## Sama kaikissa suunnissa

- Selattava on se, mihin integraatio ylettyy: OneDrive ja seuratut
  SharePoint-sivustot sillä tarkkuudella, millä ne on valittu (kirjasto
  kokonaan). Ei Microsoftin koko käyttöliittymää.
- Taso sanotaan kerran tiedostojen yllä. Täysi: agentti voi muuttaa, muutos
  siirtyy Microsoftiin muutamassa minuutissa ja siellä muokkaajaksi näkyy
  henkilön oma nimi. Luonnokset ja Vain luku: tiedostot ovat vain luku
  (luonnostaso koskee vain postia); jokaisen tiedoston kohdalla lukee
  "Agentti ei voi muuttaa tätä tiedostoa".
- Agentin muutos näkyy merkkinä *Agentti loi / muokkasi 10.42* tiedoston
  rivillä ja tiedoston näkymässä, jossa on keskustelun nimi linkkinä, tieto
  siitä, onko muutos jo Microsoftissa (*Siirtyy Microsoftiin…* → *Microsoftissa
  10.48*), ja tekstitiedoston kohdalla agentin muutos rivi riviltä.
- "Agentti ei näe": valitsematon kirjasto (*Valitse kirjastot*), seurattu
  sivusto, jonka kirjastoihin henkilöllä ei ole pääsyä, ja yleisohje: vain
  seuratut sivustot tulevat mukaan.
- *Anna agentille* lisää tiedoston viestiin sirulla; agentti saa tiedoston
  sijainnin ja lukee sen itse. Tiedostoa ei kopioida eikä ladata.
- *Avaa SharePointissa / OneDrivessa* vie Microsoftin omaan näkymään.

## Yläpalkin ohjaimet

- *Taso*: Täysi (oletus) / Luonnokset / Vain luku. Vain luku -tasolla agentti
  on samassa keskustelussa tallentanut raportin työtilaan, koska SharePoint
  on vain luku; muutoslista on tyhjä ja kertoo sen.
- *Alusta* soittaa alusta: viimeinen muokkaus on taas matkalla Microsoftiin
  ja siirtyy kuudessa sekunnissa.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-m365-selaus/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-m365-selaus/check.mjs \
  design-system/prototypes/dist/m365-selaus/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px vaaleana: oletus,
muokatun tiedoston näkymä agentin muutoksineen ja siirtyminen
Microsoftiin, tiedoston antaminen agentille ja viestin lähetys, vain luku
-taso (ei merkkejä, lukko tiedostossa, muutoksen edeltävä sisältö) ja "Agentti
ei näe". B:ssä lisäksi Agentin muutokset -välilehti ja vuoron linkki
tiedostoon. Oletukset myös tummana 1440 ja 390 px. 154 tarkistuspistettä,
konsoli puhdas, kuvat kertoimella 2. `index.html` on sama ilman upotettuja
fontteja glasspadia varten.
