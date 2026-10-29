# Oma kone agentin käyttöön, kierros 1

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, kirjoitettu käsin
eikä rakennettu tuotantokomponenteista. Lähde on saman hakemiston `page.html`.
`build.mjs` kokoaa sen tokenien, fonttien ja yhteisen valitsimen kanssa, ja
`verify.mjs` rakentaa ja tarkistaa sen. Kuvat ovat `evidence/`-hakemistossa
AVIF-muodossa laitteen skaalauksella 2. Kaikki tiedot ovat keksittyjä.

## Valitsin ja ohjaimet

- **Alareunan valitsin**: kolme tapaa viedä ihminen käyttöönoton läpi.
  Näppäimet 1–3 vaihtavat.
- **Näkymä**:
  - *Asetukset* on Asetukset › Omat koneet;
  - *Käyttöönotto* on se kohta, jossa suunnat eroavat: dialogi, sama sivu
    tai keskustelu;
  - *Keskustelu* on tavallinen työkeskustelu, jossa agentti käyttää konetta.
    Se on sama kaikissa suunnissa.
- **Tila** asettaa lähtötilan:
  - Ei palvelimella;
  - Ei käytössä;
  - Odottaa Tailscale-kirjautumista;
  - Avainrivi puuttuu;
  - Yhdistetty;
  - Kone ei vastaa;
  - Vanhentunut;
  - Peruttu koneelta.

  Tilasta voi jatkaa painikkeilla.
- **Kone**: macOS tai Linux. **Ikkuna**: Oma, 1280 tai Puhelin.
  **Teema**: Tumma tai Vaalea.

## Suunnat (akseli: miten ihminen viedään Tailscalen, avainrivin ja vahvistuksen läpi)

1. **Ohjattu.**
   - *Lisää kone* avaa viisivaiheisen dialogin: Tailscale, Kone,
     Etäkirjautuminen, Avainrivi, Vahvistus.
   - Seuraava aukeaa vasta, kun vaihe on oikeasti valmis.
   - Asetussivu on vain yhteenveto, ja Uusi pääsy avaa dialogin suoraan
     avainrivin kohdalta.
2. **Tilasivu.**
   - Kaikki on yhdellä asetussivulla. Koneen kortti on neljän kohdan
     tarkistuslista: kone verkossa, etäkirjautuminen, avainrivi ja koneen
     tunniste.
   - Kohdat kuittautuvat sitä mukaa kuin Habitat ne toteaa, ja ensimmäinen
     keskeneräinen on auki.
   - Sama lista toimii myöhemmin vianetsintänä: vanhentunut tai peruttu rivi
     näkyy punaisena kohtana, ja korjaus on samassa paikassa.
3. **Agentin kanssa.**
   - *Yhdistä kone agentin kanssa* avaa keskustelun. Agentti selittää ja
     vastaa kysymyksiin, kuten "Voiko ylläpitäjä käyttää tätä?" ja "Mitä täysi
     levyn käyttöoikeus tarkoittaa?".
   - Kentän yläpuolella on Habitatin oma tilakortti. Siinä ovat
     kirjautumislinkki, konelista, kopioitava komento, Tarkista ja sormenjälki.
   - Avainriviä ei ole koskaan agentin viestissä, koska väärä avain veisi
     pääsyn jollekulle toiselle. Kortti lukee avaimen tiedostosta.

Kaikissa suunnissa sama kolmen kohdan teksti kertoo, mitä yhteys antaa:

- agentti saa koneella kaiken, mitä käyttäjäsi saa, eikä kysy lupaa
  jokaiseen komentoon;
- palvelimen ylläpitäjä (root) pääsee samaa reittiä;
- varma katkaisu tehdään koneella.

Suunnassa 1 teksti on viimeisessä vaiheessa ennen tallennusta, suunnassa 2
aina sivulla ja suunnassa 3 agentin ensimmäisessä viestissä. Taukoa ei ole
missään.

## Kokeile näin

1. Suunta 1, Tila *Ei käytössä*:
   - *Lisää kone* › *Yhdistä Tailscaleen* › *Avaa kirjautumissivu*. Odota
     sekunti.
   - *Seuraava* › valitse `jarin-macbook-air` › *Seuraava* › *Seuraava*.
   - *Tarkista yhteys*: kone hylkää avaimen.
   - *Kopioi* › *Tarkista yhteys* › *Seuraava* › *Täsmää, tallenna*.
2. Suunta 2, sama alku: valitse `tyoasema`, ja ohjeet vaihtuvat Linuxiin.
   Kopioi komento, *Tarkista nyt* ja *Täsmää*. Kokeile sitten *Poista*:
   vahvistus kertoo, että rivi pitää poistaa myös koneelta.
3. Suunta 3:
   - Kysy "Voiko palvelimen ylläpitäjä käyttää tätä?".
   - Tee käyttöönotto kortista ja katso, miten agentti kommentoi hylättyä
     avainta.
4. Tila *Vanhentunut*:
   - suunnassa 1 *Uusi pääsy* avaa dialogin avainrivin kohdalta;
   - suunnassa 2 avainrivin kohta on punainen ja auki;
   - suunnassa 3 uusiminen jatkuu keskustelussa.

   Koneen tunnistetta ei kysytä uudelleen.
5. Näkymä *Keskustelu*:
   - Yhdistetty: komentoriveillä on konesiru, ja otsikossa näkyy auki oleva
     yhteys.
   - Kone ei vastaa, Vanhentunut ja Peruttu: agentti kertoo syyn eikä yritä
     muuta reittiä.
6. Puhelin: kaikki toimii, mutta pitkä komento on puhelimessa raskas.
   Käyttöönotto on käytännössä tietokonetyötä.

## Mitä sinun pitäisi päättää

- **Mikä suunta?** Suosittelen suuntaa 2 (Tilasivu). Perustelut ovat
  `../../result.md`:ssä.
- **Pääsyn oletuskesto**: 30 päivää, ja valittavana ovat 7, 30 ja 90 päivää.
  Pitäisikö olla myös "ei vanhene"? En tarjonnut sitä.
- **Asetusten paikka**: oma osio *Omat koneet* heti Tiedot agenteille
  -osion jälkeen. Vaihtoehto on rivi Tiedot agenteille -osion sisällä.
