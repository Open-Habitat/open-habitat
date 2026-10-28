# Tilannekatsauksen asetukset, kierros 2

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, kirjoitettu käsin
eikä rakennettu tuotantokomponenteista. Lähde on
`design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset-2/`, ja
tiedosto rakennetaan ja tarkistetaan komennolla
`node design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset-2/verify.mjs`
(Playwright `web/node_modules`ista, kuvat ffmpeg:llä). Kuvat ovat
`evidence/`-hakemistossa AVIF-muodossa laitteen skaalauksella 2. Kierros 1 on
vertailun vuoksi edelleen tallessa hakemistossa `../recap-settings/`.

## Mitä muuttui päätöksesi jälkeen

- Tilannekatsauksella on nyt **oma osio** Asetuksissa, eikä se ole enää Tekoälyn alla.
  Sivu avautuu suoraan siihen, ja kortin ratas vie sinne.
- Teksti "Lasketaan viimeisestä viestistä … pisin viive on 5 min" on poistettu.
- **Viive on vapaa**: liukusäädin 1–9 min puolen minuutin välein, ja arvo
  näkyy vieressä. Raja tulee daemonista. Agentti pysähtyy 10 minuutin
  hiljaisuuden jälkeen, ja katsaus tarvitsee elävän agentin, joten 9 min on
  pisin, joka toimii aina. Alle minuutin viive taas laukeaisi, vaikka vielä
  luet keskustelua, koska selain ilmoittaa lukemisesta 20–30 s välein.
  Perustelut ja tiedostopolut ovat `result.md`:ssä.
- **Pituusparametrit** ovat mukana: katsauksen sanat, Seuraavaksi-rivin sanat,
  luettavien viestien määrä, luettavan historian tokenit, yhden viestin
  tokenit, vastauksen tokenit ja se, monennenko vuoron jälkeen ensimmäinen
  katsaus tulee. Oletukset ovat nykyiset arvot, joten osion avaaminen ei
  muuta mitään.
- **Mallivalitsin** on sama komponentti kuin Tekoäly › Oletusmalli: kenttä,
  josta aukeaa paneeli. Paneelissa ovat palveluntarjoajan välilehdet,
  mallirivit ja vanhemmat mallit. Tilannekatsauksessa ylimpänä on
  *Automaattinen*, ja Fable ja Opus ovat harmaina ("ei taustatöihin").
  Oletusmallissa on lisäksi ajattelutaso. Puhelimessa paneeli aukeaa alhaalta
  arkkina.

## Valitsin ja ohjaimet

- **Alareunan valitsin**: kolme tapaa ryhmitellä samat säädöt ja vertailuna
  **Nykyinen** (tuotanto nyt, ei osiota). Näppäimet 1–4 vaihtavat.
- **Näkymä**: Asetukset tai Keskustelu. Sivupalkin nimesi avaa Asetukset,
  keskustelun nimi palauttaa keskusteluun.
- **Hiljaisuus** (0, 1, 3, 5, 9 min) simuloi ajan kulumista: kortti tulee,
  kun hiljaisuus on vähintään asettamasi viive.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Tumma tai Vaalea.

## Suunnat (akseli: miten parametrit ryhmitellään)

1. **Perus + lisät**: yhdessä kortissa ovat Tilannekatsaus, viive, malli ja
   katsauksen pituus. Muut luvut ovat *Lisäasetukset*-taitoksen takana.
   Taitoksen otsikossa näkyvät aina nykyiset luvut ja kuinka moni niistä on
   muutettu.
2. **Kaikki näkyvissä**: kaikki luvut neljässä ryhmässä: Milloin, Malli,
   Mitä katsaus lukee ja Mitä katsaus kirjoittaa. Lopussa on yhteenveto ja
   Palauta oletukset.
3. **Tasot**: Lyhyt / Tavallinen / Perusteellinen asettaa kaikki luvut
   kerralla, ja niiden arvot näkyvät taulukkona. *Oma* avaa luvut
   muokattaviksi. Tavallinen on nykyinen katsaus.

## Kokeile näin

1. Suunta 1: vedä viive 4,5 minuuttiin. Siirry keskusteluun ja kokeile
   Hiljaisuus 3 min (ei korttia) ja 5 min (kortti).
2. Avaa Malli. Yritä valita Fable, mikä ei onnistu. Valitse ChatGPT-tilaus ›
   GPT 6 Luna, niin esikatselu kertoo mallin. Avaa sitten Tekoäly ›
   Oletusmalli: se on sama valitsin, mutta siinä on ajattelutaso eikä
   Automaattista.
3. Avaa Lisäasetukset ja pienennä viestien määrää: otsikkoon tulee "1 muutettu".
4. Suunta 2: aseta Vastauksen yläraja 128:aan, niin rivi varoittaa, että
   katsaus voi katketa. Palauta oletukset korjaa sen. Nosta katsauksen
   pituus 60 sanaan, niin esikatselu pitenee.
5. Suunta 3: vaihda Lyhyt ja Perusteellinen ja katso taulukko. Valitse Oma
   ja muuta lukua.
6. Puhelin ja Vaalea: avaa malli, ja arkki aukeaa alhaalta.

## Mitä sinun pitäisi päättää

- Mikä ryhmittely (1, 2 vai 3)? Suosittelen suuntaa 1 (`result.md`).
- Riittääkö 1–9 min, vai pitääkö viiveen voida olla pidempi? Pidempi viive
  vaatii, että daemon pitää agentin hereillä odottavan katsauksen vuoksi.
- Näytetäänkö historia tokeneina (arvio: tavut / 4, kuten nyt) vai
  jossain muussa yksikössä?
- Koskeeko valittu malli vain tilannekatsausta (oletukseni) vai myös
  keskustelujen automaattisia nimiä?
