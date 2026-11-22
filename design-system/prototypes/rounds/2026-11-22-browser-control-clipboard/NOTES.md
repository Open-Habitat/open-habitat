# Palvelinselaimen ohjaus ja leikepöytä — 22.11.2026

Akseli: missä vuoro ja leikepöytä asuvat palvelinselaimen kuvan ympärillä.
Käytös on kaikissa sama, vain sijoittelu vaihtuu.

1. **Kehys:** kuvan reuna kertoo vuoron (yhtenäinen = sinä, katkoviiva =
   agentti). Vuoro ja Valmis ovat vasemmassa kielekkeessä, Leikepöytä
   avautuu oikeasta kielekkeestä. Vähiten tilaa, heikoin löydettävyys.
2. **Palkki (suositus):** tuotannon nykyinen vuoronauha pysyy yläreunassa, ja
   agentin viesti on sen tekstinä. Kuvan alla on leikepöytäpalkki: Liitä…,
   Kopioi valinta, etäkopion painike ja ilmoitukset.
3. **Paneeli:** kuvan vieressä on aina auki oleva paneeli, jossa ovat vuoro,
   agentin viesti, liittökenttä ja etäkopio. Puhelimessa paneeli on kuvan alla.

Yhteinen käytös (tilanne-valikko):

- **Sinä ohjaat: kirjautuminen** (oletus). Kirjoita kuvaan. ⌘/Ctrl+V liittää
  sivulle, ja kuittaus kertoo merkkimäärän mutta ei sisältöä. Valitse
  palvelutunnus ja paina ⌘/Ctrl+C, niin se kopioituu koneellesi.
- **Tiukka selain** -valinta jäljittelee selainta, joka ei anna leikepöytää
  ilman painallusta. Liittäminen kuvaan ohjaa silloin tekstikenttään, ja
  etäkopio jää Kopioi koneellesi -painikkeen taakse. Jos sekin estetään,
  teksti näkyy valittavana.
- **Agentti odottaa sinua:** klikkaus kenttään tai mikä tahansa näppäin ottaa
  ohjauksen, ja sama klikkaus tai näppäin menee sivulle.
- **Agentti kesken:** agentti kirjoittaa. Klikkaus ei mene sivulle vaan avaa
  varoituksen: Ota ohjaus nyt (agentin seuraavat askeleet perutaan, ja
  puolikas syöte jää näkyviin ilmoituksena), Ota, kun se on valmis, tai Peru.
- **Agentti haluaa jatkaa:** agentin viesti ja Valmis, agentti jatkaa.
- **3 minuutin tauko:** näkyvä lähtölaskenta ja Pidä ohjaus. Automaattinen
  palautus on vain silloin, kun agentilla ei ole avointa pyyntöä.

## Rajaus

Esityskielen kopio tokenien päällä, ei React-tuotantokomponentteja. Tuotannon
`BrowserViewer.tsx`, `ServerBrowser.tsx`, `components/ServerBrowser.tsx`,
`text/serverBrowser.ts`, `internal/browserhost/` ja selaintaito luettiin.
Sheetin otsikko, vuoronauha ja totuusrivi noudattavat tuotantoa. Etäsivu on
keksitty HTML-kuva noVNC-kanvaasin tilalla, ja sen värit ovat kiinteät, koska
kolmannen osapuolen sivu ei seuraa Habitatin teemaa. Agentti on käsikirjoitettu.
Ei verkkoa, tallennusta tai uusia riippuvuuksia. Kierros käyttää yhteisiä
`lib/picker.css`- ja `lib/picker.js`-tiedostoja sekä `picker-check.mjs`:ää.
Kanvaasin näppäimet pysäytetään ennen valitsimen pikanäppäimiä, joten
kuvaan kirjoitettu "1" ei vaihda suuntaa.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu (`npm ci --prefix web`):

```sh
node design-system/prototypes/rounds/2026-11-22-browser-control-clipboard/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-browser-control-clipboard/check.mjs \
  design-system/prototypes/dist/browser-control-clipboard/offline.html <evidence-dir> [--quick]
```

Osoitevalinnat: `?v=1|2|3&lang=fi|en&theme=light|dark|contrast`. Linuxissa
komennot ajetaan scratch-leasen alla, yksityisellä TMPDIR:llä ja `umask 077`:llä.

Check käy läpi 36 yhdistelmää: 3 suuntaa × 2 kieltä × 3 teemaa × 1440/390 px.
Jokaisessa se kirjoittaa kuvaan, liittää (synteettinen paste-tapahtuma), kokeilee
tiukan selaimen tekstikentän ja näppäilyt, etäkopion molemmat polut, Valmiin,
ohjauksen ottamisen odottavalta agentilta klikkauksella ja näppäimellä sekä
kesken olevalta agentilta kolmella valinnalla. Lisäksi se kokeilee agentin
jatkopyynnön, tauon, valitsimen, vaakavuodon, puhtaan konsolin ja estetyt
HTTP-pyynnöt. Axe tarkistaa 390 px:n vaalean suomenkielisen näkymän jokaisesta
suunnasta.
