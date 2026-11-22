# Palvelinselaimen liittäminen ja näppäilyt — 22.11.2026

Akseli: mitä ⌘V / Ctrl+V palvelinselaimen kuvassa tekee. Näkymä on
loppuasetelma, johon `server-browser-one-bar` ja
`server-browser-password-entry-notice` vievät: yksi yläpalkki (otsikko,
vuorosiru, Leikepöytä-ponnahdus, Valmis / Ota ohjaus, Sulje selain, ×), ja
kuvan reuna kertoo vuoron (yhtenäinen = sinä, katkoviiva = agentti).

1. **Kysyy (suositus):** ⌘V avaa Leikepöydän. Leikepöydän teksti on
   kentässä piilotettuna, eikä mitään ole lähetetty. Fokus on
   *Kirjoita näppäilyinä* -painikkeessa, joten Enter lähettää näppäilyinä;
   *Liitä sivulle* on vieressä.
2. **Ohjaa:** ⌘V avaa Leikepöydän tyhjänä ja kertoo, että ⌘V ei liitä
   suoraan sivulle. Fokus on kentässä. Toinen ⌘V liittää kenttään (vain
   paikallisesti), tai salasanan voi kirjoittaa siihen.
3. **Vinkki:** ⌘V liittää kuten nyt (kuittaus kertoo vain merkkimäärän), ja
   ilmoituksessa on painike *Salasanan voit kirjoittaa näppäilyinä*, joka
   avaa tyhjän kentän.

Kaikissa sama:

- *Kirjoita näppäilyinä* ja *Liitä sivulle* sulkevat ponnahduksen ja
  palauttavat fokuksen kuvaan. Kuva välähtää, ja niin kauan kuin kuvalla on
  fokus, sen kulmassa lukee *Näppäimet menevät sivulle*. Seuraava Backspace,
  Enter tai Tab menee sivulle. Escape ja Sulje tekevät saman lähettämättä.
- Kenttä on piilotettu joka avauksella. Silmä sen oikeassa reunassa
  (`aria-pressed`, nimi *Näytä teksti* / *Piilota teksti*) näyttää tekstin;
  yliviivattu silmä piilottaa.
- Ohje on sama kolmena rivinä: näppäilyt eivät käy leikepöydän kautta (ja
  suoraan kenttään kirjoitettu salasana ei jää omaankaan leikepöytähistoriaan),
  liittäminen käy etäkoneen leikepöydän kautta ja tyhjennetään palautuksessa,
  ja kummallakin tavalla teksti päätyy sivulle eikä sitä piiloteta agentilta.
- Liittämisen jälkeen ponnahdus kertoo, montako merkkiä etäkoneen
  leikepöydällä on; Valmis tyhjentää sen ja sanoo sen.
- Kun agentti odottaa, ⌘V kuvassa ottaa ensin ohjauksen.

## Rajaus

Esityskielen kopio tokenien päällä, ei React-komponentteja. Tuotannon
`BrowserViewer.tsx`, `components/ServerBrowser.tsx` ja
`text/serverBrowser.ts` luettiin; tekstit noudattavat niitä. Etäsivu on
keksitty HTML-kuva noVNC-kanvaasin tilalla kiintein värein. Prototyyppi ei
lue oikeaa leikepöytää: ⌘V käyttää katselmointiotsakkeen keksittyä tekstiä,
jotta oikea kopioitu salasana ei koskaan näy sivulla. Rivinvaihtojen
Enter-varoitus ja etäkopion tiukan selaimen polut ovat tuotannossa ennallaan
eivätkä ole tässä mukana. Yhteiset `lib/picker.css`, `lib/picker.js` ja
`picker-check.mjs`; ei verkkoa eikä uusia riippuvuuksia.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu (`npm ci --prefix web`):

```sh
node design-system/prototypes/rounds/2026-11-22-browser-paste-flow/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" timeout 600 \
  node design-system/prototypes/rounds/2026-11-22-browser-paste-flow/check.mjs \
  design-system/prototypes/dist/browser-paste-flow/offline.html <evidence-dir> [--quick]
```

Osoitevalinnat: `?v=1|2|3&lang=fi|en&theme=light|dark|contrast`. Linuxissa
komennot ajetaan scratch-leasen alla, yksityisellä TMPDIR:llä ja `umask 077`:llä.

Check käy läpi 24 yhdistelmää: 3 suuntaa × fi/en × vaalea/tumma × 1440/390 px.
Jokaisessa se kirjoittaa kuvaan, painaa Control+V ja tarkistaa suunnan
käytöksen, silmän paikan ja tilan, rehellisyysrivin (ja ettei väitettä
"agentti ei näe" ole), lähettää näppäilyinä, tarkistaa fokuksen kuvassa ja
että Backspace menee sivulle, Escapen, liittämisen etäleikepöytähuomautuksen
ja Valmiin tyhjennyksen, ohjauksen ottamisen ⌘V:llä, valitsimen,
vaakavuodon, puhtaan konsolin ja estetyt HTTP-pyynnöt. Axe tarkistaa 390 px:n
vaalean suomenkielisen ponnahduksen jokaisesta suunnasta.
