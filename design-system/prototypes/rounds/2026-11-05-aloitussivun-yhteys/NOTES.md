# Aloitussivu, kun yhteyttä ei saada – kierros 1

Issue `proto-landing-connection-status`. Yksi näkymä: latausaloitussivu
(Merkki), kun ensimmäinen luku epäonnistuu, työpöydällä (1440) ja
puhelimessa (390, Villen tapaus laitelinkin jälkeen). Nyt on tuotannon
`Landing`-komponentti sellaisenaan; suunnat käyttävät sen merkintää ja
luokkia (`LandingMark`, `Landing.css`), `ControlButton`ia, `AppShell`ia,
`AccountShelf`ia ja palautumisen jälkeen `WorkspaceRail`ia. Kaikki on
synteettistä: sivulta ei lähde pyyntöjä, ja kello on simuloitu.

## Akseli ja suunnat

Akseli: miten epäonnistuminen sanotaan ja miten automaattinen uusi luku
näkyy.

- **Nyt**: "Palvelin ei vastannut" joka tilanteessa; palaa itse vain, kun selain ilmoittaa verkon palanneen.
- **A Neutraali**: "Yhteyttä ei saatu" ilman väitettä palvelimesta; offline vain vihjeenä; uusi yritys hiljaa taustalla.
- **B Laskuri**: sama tila, ja seuraava yritys näkyy laskurina palkissa; Yritä nyt ohittaa odotuksen.
- **C Tarkista**: kertoo, mitä voit itse tarkistaa (verkko, VPN); uusi yritys taustalla yhdellä rivillä.

Suositus: **B Laskuri**.

## Yläpalkin ohjaimet

- *Tilanne*: yhteys ei toimi vaikka laite on verkossa (VPN, DNS, aikaraja;
  oletus), laite ilmoittaa olevansa offline, palvelin vastasi virheellä tai
  kelvottomalla vastauksella, kirjautuminen ja tiedot eivät täsmää kolmesti.
- *Palauta yhteys / Katkaise yhteys*: verkko palaa. Offline-tilanteessa
  selain antaa silloin `online`-tapahtuman, ja kaikki suunnat, myös Nyt,
  yrittävät heti. VPN-tilanteessa tapahtumaa ei tule: Nyt jää odottamaan
  nappia, suunnat palautuvat seuraavalla automaattisella yrityksellä.
  Ristiriitatilanteessa nappi on *Poista ristiriita*.
- *Aika 1× / 10×* ja *Kelaa 15 min*: automaattisten yritysten sarja ja sen
  loppu näkyvät odottamatta.
- *Alusta* soittaa alusta: *Yhdistetään palvelimeen…* ja epäonnistuminen.

## Sama kaikissa suunnissa

- Automaattinen uusi yritys koskee vain lukuja (istunto ja snapshot), ei
  koskaan kirjoituksia, laitelinkkiä eikä kirjautumista. Välit 5, 10, 20, 40
  ja 60 s, sitten minuutin välein; 15 minuutin jälkeen sivu lakkaa
  yrittämästä itse, ja nappi toimii edelleen.
- Kun selain ilmoittaa olevansa offline, laskuri ei pyöri turhaan: sivu
  odottaa `online`-tapahtumaa ja kertoo sen.
- Palkki on epäonnistuessa neutraali harmaa viiva eikä virheen sävy: sivu ei
  tiedä, onko jokin rikki. Yrityksen ajan palkki liukuu ja merkin piste
  sykkii kuten latauksessa.
- Palvelimen virhevastaus sanotaan omana tilanaan (*Työtiloja ei saatu
  luettua*): jokin vastasi, joten yhteys ei ollut poikki.
- Ristiriitatilanne pysyy suljettuna: ei automaattista yritystä, ei mitään
  kenenkään työtiloista. Ensisijainen teko on *Kirjaudu uudelleen*, toissijainen
  *Yritä uudelleen*.
- Tili (`AccountShelf`) näkyy vain, kun istuntoluku nimesi henkilön
  (virhevastaus ja ristiriita), kuten tuotannossa.
- Onnistunut palautuminen: *Hei Aino. Haetaan työtilojasi…* ja sitten sovellus.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-05-aloitussivun-yhteys/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-05-aloitussivun-yhteys/check.mjs \
  design-system/prototypes/dist/aloitussivun-yhteys/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi neljässä tilanteessa
1440 ja 390 px vaaleana (oletukset tummana kahdessa tilanteessa), varmistaa
ettei suunnissa lue "Palvelin ei vastannut", palauttaa VPN-yhteyden (Nyt
odottaa nappia, suunnat palautuvat itse), offline-verkon (kaikki palautuvat),
pitää ristiriidan suljettuna kaksi minuuttia ja kirjautuu uudelleen, ja
kelaa 15 minuuttia sarjan loppuun (222 tarkistuspistettä, konsoli puhdas,
kuvat kertoimella 2). `index.html` on sama ilman upotettuja fontteja
glasspadia varten.
