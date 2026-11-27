# Palvelinselaimen kehys, kierros 1 · 27.11.2026

Issue `server-browser-frame`. Jari: kehys on liian raskas (Ota ohjaus,
Valmis ja Sulje selain ovat erillisiä askeleita, välilehden sulkeminen
puuttuu), Leikepöytä-valikko on turha, koska ⌘/Ctrl+V kirjoittaa jo, ja kuva
on pieni.

Kevyempi kehys on sama kaikissa suunnissa:

- Ei Ota ohjaus -painiketta. Klikkaus tai näppäin kuvassa ottaa ohjauksen,
  kuten tuotannossa jo nyt; ⋯-valikossa on Ota ohjaus näppäimistölle.
- Yksi lopetus: kun ohjaat, **Valmis** antaa selaimen agentille, tyhjentää
  etäkoneen leikepöydän ja sulkee näkymän. Kun agentti ohjaa, × vain sulkee.
  Harvinainen "anna takaisin ja jatka katsomista" on ⋯-valikossa.
- Välilehdet ovat välilehtiä: edessä oleva on korostettu, ja sen × näkyy
  aina. Ponnahdusikkuna on oma välilehtensä merkillä *ponnahdus*. Puhelimessa
  ja pillerissä välilehdet ovat valikossa, jossa on myös *Sulje tämä
  välilehti*. Viimeistä välilehteä ei suljeta (kuten tuotannossa).
- Ei Leikepöytää. ⌘/Ctrl+V kirjoittaa tekstin näppäilyinä. Jos teksti on
  liian pitkä tai siinä on rivinvaihto, kuittauksessa on painike *Liitä
  leikepöydän kautta*. ⋯-valikossa ovat *Liitä pitkä teksti…*, *Kirjoita
  sivulle…* (puhelimessa myös palkin avainpainike), *Kopioi valinta
  koneellesi*, *Sulje tämä välilehti*, *Sulje selain* ja lause siitä, että
  agentti saa käyttää kaikkea, mihin selain on kirjautunut.
- Vuoro näkyy reunasta (katkoviiva = agentti, yhtenäinen = sinä, tuotannon
  `sb-frame`) ja palkin sirusta. Agentin pyyntö on palkin alla, kunnes otat
  ohjauksen. Tuotannon kesken-kysymys ja "Ota, kun se on valmis" ennallaan.

Akseli: missä selain asuu ja miten ohjaimet ovat sen päällä.

1. **Paneeli:** tuotannon oikea paneeli (`ViewSplit`), ohut palkki. Kun
   ohjaat, paneeli on leveä; keskustelu on yhden painalluksen päässä.
2. **Ikkuna** (suositus): selain täyttää ikkunan, sama ohut palkki.
3. **Pilleri:** kuva täyttää ikkunan, ohjaimet kelluvat pillerissä kuvan
   päällä; pillerin voi siirtää alas.

Katselmointipalkissa: tilat (Agentti työssä, Odottaa sinua, Sinä ohjaat,
Ponnahdusikkuna, Annettu takaisin, Selain suljettu), *Monta välilehteä*,
*Näyttö seuraa kokoa* (sivu piirtyy näkymän kokoiseksi, kun ohjaat; vaatisi
host-muutoksen), *Vertaa nykyiseen* (tuotannon `BrowserSheet`/`BrowserFrame`
saman sivun ympärillä) ja *⌘V: pitkä teksti* (kieltäytyminen painikkeineen).
Kuvan koko näkyy palkissa.

## Rajaus

Tuotannon komponentteja: sovelluskehys, sivupalkki ja Oma selain -rivi,
keskustelu, Selain-kortti, `ViewSplit`, painikkeet ja valikot, kehyksen
reuna, kesken-kysymys ja kuittauksen tyyli sekä vertailun koko nykyinen
arkki. Kierroksen omia: ohut palkki, välilehtirivi, pilleri, tekstidialogi,
piirretyt kolmannen osapuolen sivut (kiinteät värit) ja kokomittari.
Prototyyppi ei lue oikeaa leikepöytää: ⌘V käyttää keksittyä tekstiä.
Täysikokoiset näkymät eivät ole modaaleja, jotta katselmointipalkki toimii
niiden päällä. Vain suomeksi. Kokonaan synteettinen.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu lukkotiedostosta.
Linuxissa scratch-hakemistossa, omalla TMPDIR:llä ja `umask 077`:llä.

```sh
round=design-system/prototypes/rounds/2026-11-27-palvelinselain-kehys-1
node "$round/build.mjs"   # dist/2026-11-27-palvelinselain-kehys-1/offline.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node "$round/check.mjs" design-system/prototypes/dist/2026-11-27-palvelinselain-kehys-1/offline.html <out> [--quick]
```

Osoitevalinnat: `?v=1|2|3&theme=light|dark&state=agent|ask|person|popup|back|stopped&many=1&follow=1&compare=1&measure=1`.
`check.mjs` käy kolme suuntaa × Päivä/Yö × 1440/390 px: valitsin, kevyt
kehys (ei Ota ohjaus- eikä Leikepöytä-painiketta, ⋯ ja totuuslause),
klikkaus ottaa ohjauksen, Ctrl+V kirjoittaa, kieltäytyminen ja sen painike,
pitkän liitteen dialogi ja sen rehellisyyslause, Valmis (sulkee ja kertoo
leikepöydän tyhjennyksestä), ponnahdusikkuna välilehtenä ja sen sulkeminen,
kesken-kysymys ja odotus, anna takaisin ja jatka katsomista, monta
välilehteä, viimeisen välilehden suoja, Sulje selain ja vertailuarkki. Sen
jälkeen se mittaa kuvan kaikissa suunnissa ja tuotannon arkissa 1440 × 900,
1440 × 780, 1280 × 720 ja 390 × 844 px (`sizes.json`). Ei vaakavuotoa, ei
ulkoisia pyyntöjä, konsoli puhdas.
