# Kokeelliset ominaisuudet: kierros 1

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka ei tee verkkopyyntöjä.
Sivun yläreunan valitsimessa on kolme suuntaa. Vaihda niitä numeroilla 1–3 tai nuolilla ←/→.
Sivu aukeaa asetusten uuteen osioon **Kokeelliset ominaisuudet**. Kaikki kolme ominaisuutta
ovat aluksi pois päältä.

## Kokeile näin

1. Laita ominaisuuksia päälle Päällä-painikkeesta. Tallennus kestää hetken, ja sen jälkeen
   rivi kertoo: "Käytössä nyt kaikilla laitteillasi."
2. Sulje asetukset ruksista tai Esc-näppäimellä. **Iltakierros**-keskustelussa näet:
   - kirjoituskentän yläpuolella rivin "Sillä aikaa · Kuvien pakkaus", jos *Seuraava odottava
     keskustelu* on päällä;
   - Workerit-paneelin riveillä työn sanoina ("2 committia · 3 muutosta", "ei vielä
     muutoksia") ja sivupalkin Galleria-rivillä samat tiedot, jos *Workerin työ rivillä* on päällä.
3. Avaa sivupalkista **Status-skripti** (aurinkokello). Kun *Päätteen Pi:n katselu* on päällä,
   alareunassa on yksi lyhyt lause ja painike **Katso päätteessä**. Painike avaa tmux-ikkunan
   peilin päätepaneeliin vain luettavana. Kun ominaisuus on pois, alareunassa on tämän
   päivän teksti.
4. Asetuksiin pääsee takaisin sivupalkin alareunan Jari-valikosta.
5. Ylälaidan **Tallennus epäonnistuu** näyttää, mitä tapahtuu, kun daemon ei saa valintaa
   tallennettua: valinta ei vaihdu, ja rivi pyytää lukemaan tallennetun valinnan uudelleen,
   kuten Editori-asetus tekee nyt.

Puhelimessa sivupalkki aukeaa ☰-painikkeesta. Asetuksissa ensin näkyy osiolista ja sitten
osio, kuten tuotannossa.

## Suunnat: missä kokeilu selittää itsensä

**1 Rivit.** Osio on samanlainen kuin Editori ja Ulkoasu: johdanto ja yksi kortti, jossa
jokaisella ominaisuudella on rivi (nimi, yksi lause ja Pois/Päällä). Keskustelussa
ominaisuus näyttää tavalliselta, eikä mikään kerro sen olevan kokeellinen.

**2 Merkki.** Asetuksissa samat rivit. Kun ominaisuus on päällä, sen kohdalla on pieni
**Kokeellinen**-merkki (puhelimessa pelkkä kolvi-ikoni). Merkistä aukeaa pieni ikkuna,
joka kertoo ominaisuuden nimen ja että se voi muuttua. Siinä on painikkeet **Poista
käytöstä** ja **Asetukset**. Poistosta tulee ilmoitus, jossa on **Kumoa**. Asetukset-painike
vie suoraan oikealle riville.

**3 Esittely.** Asetuksissa jokaisella ominaisuudella on oma kortti:
- pieni kuva siitä, mitä ominaisuus lisää (harmaana, kun se on pois);
- *Missä*, *Mitä näkyy* ja *Edellyttää*, esimerkiksi tmux tai gh-kirjautuminen;
- linkki, joka näyttää paikan keskustelussa.

Keskustelussa ominaisuus näyttää tavalliselta.

Kaikissa suunnissa valinta tulee voimaan heti, kun daemon vahvistaa sen. Valinta
tallentuu tilille, joten se koskee kaikkia laitteita.

## Katso erityisesti

- Ymmärtäisikö Kaisa Rivit-suunnassa, mistä keskustelun uusi rivi tuli ja miten sen
  saa pois?
- Workerit-paneelin otsikon Kokeellinen-merkki ei kerro, mikä paneelissa on kokeellista,
  ennen kuin sen avaa. Kelpaako tämä?
- Esittelyn kuvat ovat toinen kuvaus ominaisuudesta, ja ne pitää päivittää aina, kun
  ominaisuus muuttuu.

Suositus ja perustelut ovat issuen `result.md`-tiedostossa.

## Kuvat

`evidence/` sisältää 66 AVIF-kuvaa (laitekerroin 2). Kuvat on otettu
työpöydällä (1440) ja puhelimessa (390), vaaleana ja tummana:

- asetukset pois ja päällä;
- Iltakierros;
- pääte;
- Merkki-suunnasta auki oleva merkki, poisto ja siirtyminen asetukseen;
- epäonnistunut tallennus;
- puhelimen osiolista.

Tarkistus ja kuvien tekeminen:

```
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-experimental-features/prototypes/kokeelliset/check.mjs [--evidence]
python3 scripts/screenshots-to-avif.py issues/proto-experimental-features/prototypes/kokeelliset/evidence
```
