# Täydet oikeudet takaisin

- **1 Heti** (suositus): Ota pois toimii yhdellä painalluksella osallistujarivin
  merkistä tai paneelista. Sen jälkeen keskusteluun tulee vain omistajan näkemä
  kortti: kesken ollut ajo (Pysäytä ajo), Villen vuorojen käynnistämät
  prosessit (Pysäytä) ja mitä agentti teki hänen viesteistään.
- **2 Arkki**: Ota pois… avaa arkin, joka kertoo, mitä lainattiin ja mistä
  lähtien, mitä Villen viestit saivat agentin tekemään ja mitä on käynnissä.
  Omistaja valitsee ennen vahvistusta: annetaanko ajon päättyä vain tekstinä
  vai pysäytetäänkö se heti, mitkä prosessit pysäytetään ja poistetaanko Ville
  myös keskustelusta.
- **3 Määräaika**: täydet oikeudet annetaan ajaksi (seuraavan viestin ajan, 1
  tunti, päivän loppuun tai kunnes otan pois). Merkki ja Villen näkymä
  kertovat jäljellä olevan ajan. Päättyminen tuo saman kortin kuin suunnassa
  1, ja Ota pois toimii myös heti.

Issue `multiplayer-take-back-prototype`. Suunnat, suositus ja kysymykset
Jarille ovat issuen `result.md`:ssä. Kierros jatkaa kierroksia
`2026-11-21-multiplayer-owner` ja `-guest`. Osallistujarivi, paneeli,
avatarit ja Habitat-rivit ovat niistä. Sanasto on ADR 0038:n: Täydet oikeudet
(aiempi Luotettu), Osallistuja, Vain teksti ja Salli kaikki.

## Maailma

Aino Laine (sinä, Omistaja) antoi Ville Virtaselle täydet oikeudet klo
14.05. Villen pyynnöstä agentti käynnisti `npm run preview`, joka on yhä
käynnissä. Ainon oma `npm run build -- --watch` on myös käynnissä. Klo
14.29 Ville pyysi tarkistamaan ja korjaamaan linkit, ja ajo on kesken:
`node scripts/check-links.mjs` on käynnissä. Maija Koski on tavallinen
osallistuja.

Kaikissa suunnissa sama käytös (ADR 0038 kohdat 4 ja 7):

- Kesken oleva ajo muuttuu vain tekstiksi seuraavasta työkalukutsusta
  lähtien. Jo alkanut komento ajetaan loppuun. **Ajo etenee** näyttää sen:
  tarkistus valmistuu, seuraava `edit` estetään, ja agentti kertoo tekstillä,
  mitä jäi tekemättä. Pyyntö jää odottamaan omistajan lupaa (Salli kaikki /
  Älä salli). Jos Villellä on yhä oikeudet, sama painike vie ajon loppuun
  työkaluilla.
- Aiempien vuorojen prosessit jatkuvat, kunnes joku pysäyttää ne. Vain Villen
  vuorojen käynnistämät näytetään pysäytettäviksi, omat prosessit eivät.
- Ville, jolla on yhä jako, näkee koko keskustelun ja voi kirjoittaa.
  Agentti vastaa hänelle vain tekstillä.
- Poistettu Ville ei näe keskustelusta mitään: hänen näkymänsä sulkeutuu ja
  jako katoaa Jaettu kanssasi -listasta.
- **Arkistoi** kysyy ensin ja nimeää, keiltä keskustelu katoaa. Arkistoitu
  keskustelu avautuu vain omistajalle, eikä palautus tuo osallistujia
  takaisin.

**Villen näkymä** on työpöydällä aina oikealla. Puhelimessa se avautuu
yläpalkin painikkeesta. Näkymä on tiivis kuvaus osallistujan sivusta
(jakolista, tilakaista, ajon tila ja viimeisimmät viestit), ei
osallistujan koko näkymä, jonka `-guest`-kierros näytti. `?theme=` ja
`?lang=en` valitsevat alkutilan.

Sivu koostuu tuotannon osista: `AppShell`, `WorkspaceRail`, `AccountShelf`,
`AgentHeader`, `ConversationFrame`, `ConversationStream`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`HabitatMark`, `ControlButton`, `Markdown`, tuotannon dialogirakenne ja
`Composer`. Kierroksen omia ovat merkki, kortti, arkki, kestovalinta,
odottavan pyynnön rivi ja Villen näkymä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-take-back-rights/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-21-take-back-rights/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` on oletuksena `design-system/prototypes/dist/take-back-rights`.
`web/node_modules` vastaa lukkotiedostoa (`npm ci --prefix web`).
Rakennuksen CSS-varoitukset tulevat tuotannon `Controls.module.css`:stä ja
`interactive.module.css`:stä. Tarkistus tekee 967 tarkistusta, ja konsoli
pysyy puhtaana. Se ajetaan 1440 ja 390 px:n leveydellä Päivässä, Yössä ja
Kontrastissa (kulut Päivässä ja Yössä) sekä englanniksi työpöydällä ja
puhelimessa.
