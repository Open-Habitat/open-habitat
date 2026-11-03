# Palaa aiempaan – kierros 1

Issue `proto-rewind-conversation`. Keskustelun palauttaminen aiempaan
viestiin. Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`NowSections`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `ToolRow`, `Menu`, `RadioGroup`, `TextArea`, `Button`,
`Composer` sekä React Arian dialogi tuotannon `ah-overlay`/`ah-modal`/`ah-dialog`-luokilla).
Kierroksen omia ovat vain vahvistuskortti, haaran rivi ja versiovalitsin.
Keskustelu on synteettinen; mitään ei lähetetä.

Pi:n faktat ja hostin tarpeet ovat issuen `result.md`:ssä.

## Suunnat

Akseli: mistä palaaminen aloitetaan ja mitä siitä seuraa.

- **A Palaa tähän**: oman viestin ⋯-valikosta palataan ennen viestiä; sama keskustelu jatkuu, ja jätetty osa jää taitetuksi riviksi, jonka voi avata.
- **B Uusi alku**: otsakkeen ⋯ › Palaa aiempaan avaa listan omista viesteistä; valinnasta alkaa uusi keskustelu sivupalkkiin, ja alkuperäinen jää ennalleen.
- **C Muokkaa**: oman viestin kynästä viesti muuttuu kentäksi paikallaan; muutettu lähetys jatkaa siitä, ja viestissä on versiot ‹ 1/2 ›.

Oletusnäkymässä valinta on auki ennen vahvistusta (A: vahvistuskortti viestin
alla, B: dialogi, C: viesti kenttänä), jotta suunnat erottuvat heti.
Yläpalkin *Alku › Keskustelu* näyttää tavallisen keskustelun, josta
toiminto löytyy (työpöydällä viestin toiminnot näkyvät osoittimen alla,
puhelimessa aina). *Agentti › Työssä* näyttää tilanteen, jossa vuoro on
käynnissä: vahvistus sanoo pysäyttävänsä agentin ensin
(*Pysäytä ja palaa* jne.).

## Mitä kussakin tapahtuu

Kaikissa vahvistus kertoo ennen valintaa, montako viestiä ja vastausta jää
taakse ja mitkä tiedostot agentti muutti niissä: ne jäävät ennalleen.

- **A.** Vahvistuksen jälkeen jätetty osa on yksi rivi *Aiempi jatko · 2
  viestiäsi ja 2 vastausta · 3 tiedostoa muutettu*. *Näytä* avaa sen
  himmeänä, ja *Jatka tästä jatkosta* vaihtaa jatkot keskenään. Viestisi on
  kentässä; muokkaa ja lähetä, tai lähetä sellaisenaan. Pi: `/tree`
  paikallaan.
- **B.** Dialogi listaa omat viestisi; esikatselu kertoo, mitä uuteen tulee ja
  että tämä keskustelu jää ennalleen. *Aloita uusi keskustelu* avaa
  sivupalkkiin *Kesäajan virhe (uusi alku)*; sen lopussa on rivi *Jatkoa
  keskustelusta …* ja *Avaa alkuperäinen*. Alkuperäisessä on vastaava rivi
  kohdassa, josta jatkettiin. Pi: `/fork`.
- **C.** Viesti muuttuu kentäksi muutettuine teksteineen. *Lähetä muutettu*
  jatkaa siitä, ja viestin otsakkeeseen tulee ‹ 2/2 ›. Versio 1 näyttää
  alkuperäisen viestin ja sen jatkon himmeänä. Pi: `/tree` paikallaan ja
  uusi viesti.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-03-palaa-aiempaan/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-palaa-aiempaan/check.mjs \
  design-system/prototypes/dist/palaa-aiempaan/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana ja tummana, 1440 ja 390 px:
oletusnäkymä, vahvistus, tulos, jätetyn osan avaaminen, muutetun viestin
lähetys, sisäänkäynti tavallisesta keskustelusta ja agentti työssä
(162 tarkistuspistettä, konsoli puhdas, kuvat kertoimella 2).
`index.html` on sama ilman upotettuja fontteja glasspadia varten.

Toteutuksessa B:n kohta kuuluisi `AgentHeader`in `headerMenu`-listaan, ja ⋯
näkyisi silloin myös työpöydällä (nyt vain lyhennetyssä rivissä). A ja C
tarvitsevat viestin otsakkeeseen paikan omille toiminnoille (`Message` saa
nyt vain kopioinnin).
