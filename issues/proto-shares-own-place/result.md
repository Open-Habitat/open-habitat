# Kierros 1: oma paikka jaetuille

Kierros: `design-system/prototypes/rounds/2026-11-08-jaetut/`
(`NOTES.md` kertoo tarinan, rakennuksen ja tarkistuksen). Akseli on se,
missä jaetut elävät ja miten rivi esittää itsensä.

- **Nyt**: tuotanto tänään. Osoitteet ovat Asetukset › Tili -sivulla uloskirjautumisen ja Git-identiteetin alla: otsikko, tila ja tekstipainikkeet.
- **1 Asetukset**: oma Jaetut-osio asetuksissa. Rivit ryhmissä Julkiset nyt, Vain sinä ja Päättyneet; pieni esikatselu ja kortin kuvakkeet aina näkyvissä.
- **2 Alkulehti**: etusivulla työtilojen alla Jaetut nyt -kortit isolla esikatselulla ja Kopioi linkki -painikkeella; yksityiset ja päättyneet yhden rivin takana.
- **3 Oma sivu**: Jaetut on oma sivu sivupalkissa Etusivun alla. Samat kortit kuin keskustelussa, keskusteluittain; kortti avaa esikatselun oikealle.

Kuvat: `evidence/r1-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`,
avattuna `r1-*-1-auki-*` (1: keston valikko, 2: muut osoitteet, 3:
kansio paneelissa) ja poistodialogi `r1-1-asetukset-3-poista-1440-light`.

## Mitä kaikki suunnat tekevät samoin

- Tili-sivulle jäävät vain profiili ja Git-identiteetti.
- Rivin nimi on kohteen otsikko. Sen alla ovat laji ja koko (tuotannon
  `viewFacts`/`offerFacts`), keskustelu linkkinä, työtila ja tieto
  arkistoinnista. Tila on sanoina: *Julkinen 7.12.2026 asti*, *Vain sinä*,
  *Julkisuus päättyi 6.11.* tai *Kohde on poistettu*.
- Toiminnot ovat tarjouskortin kuvakkeet (kierros 3, A Kulma) ja niiden
  perässä roskakori. Julkaisu kestää oletuspituuden, ja päivämäärä vaihtaa
  sen. Kopiointi on käytössä vain julkisessa kohteessa. Poistossa on
  tuotannon dialogi ja teksti.
- Aiemmin jaettuja ovat vanhentuneet osoitteet (maapallo julkaisee ne
  uudelleen samaan osoitteeseen) ja osoitteet, joiden kohteen agentti on
  poistanut. Jälkimmäisessä on vain roskakori.

## Host-tiedot

Kaikki tulee jo hostilta, eikä uutta rajapintaa tarvita:
`GET /api/v1/view-addresses` (otsikko, `view_id`/`offer_id`, tila,
`public_until`, `created_at`) liitetään selaimessa henkilön
näkymä- ja tarjouslistoihin (`/api/v1/views`, `/api/v1/file-offers`:
laji, tiedostot, koko, kansio, `conversation_id`) ja keskustelulistaan
(otsikko, työtila, arkistoitu). Kuvatarjouksen ja kansion kuvat ovat
hostin rajattuja pikkukuvia (`/thumbnail/<path>`), ja paneeli avaa
kohteen samoin kuin keskustelussa.

Puuttuvat tiedot, joita en keksinyt:

- **Näkymällä ei ole kuvaa.** Host ei ota näkymästä kuvaa, joten sen
  esikatselu on `</>`-merkki ja aloitustiedoston nimi. Suunnassa 3
  näkymän näkee paneelissa.
- **Poistettua osoitetta ei muisteta.** Host unohtaa sen kokonaan (ADR 0035),
  joten *aiemmin jaettuja* ovat vain vanhentuneet osoitteet ja osoitteet,
  joiden kohde on poistettu.
- **Yksityiseksi tehty ja koskaan julkaisematon ovat samaa tilaa**
  (`private`). Kumpikin näkyy muodossa *Vain sinä*.
- **Poistetun kohteen keskustelua ei tiedetä.** Rivillä on pelkkä otsikko.

## Decisions for later review

- **Samat kuvakkeet kuin kortissa, ei tekstipainikkeita** (vaihtoehto:
  nykyiset *Avaa / Kopioi linkki / Tee yksityiseksi / Poista*). Jari
  hyväksyi kortin kuvakkeet 8.11. Sama ohjain kahdessa paikassa opitaan kerran.
- **Roskakori on aina näkyvissä, ei ⋯-valikossa** (vaihtoehto: valikko).
  Poisto on tämän näkymän syy olla olemassa, koska varauskaton saa purettua
  vain sillä. Dialogi estää vahingot.
- **Vanhentunut kuuluu Päättyneisiin, ei Vain sinä -ryhmään.** Se on
  ollut julkinen, joten sen osoite voi olla muilla.
- **Suunnassa 3 mitään ei avata oletuksena.** Kapeassa sovelluskehyksessä
  avattu paneeli puristaa kortit; esikatselu avautuu painalluksesta.
- **Suunnan 3 sivupalkkirivi laskee julkiset** (*Jaetut 2*), ei kaikkia
  osoitteita. Julkinen on se, mikä on maailmalla.
- **Kansion esikatselu on 3–4 ensimmäistä kuvaa.** Se tarkoittaa yhtä
  pikkukuvapyyntöä kuvaa kohden, ja jokainen on rajattu.
- **Löydös:** tarjouskortin piilotetut kulmakuvakkeet vievät tilaa
  (`offer-card-corner-icons-in-flow`, kirjattu intakeen). Kierros ohittaa
  sen paikallisesti.
- Toteutus tarvitsee Explain-kortit molemmilla kielillä uudelle sivulle
  tai osiolle, roskakorille ja suodattimelle (suunta 3).

## Kysymykset Jarille

1. Mikä paikka: **1 Asetukset** (oma osio, tiivis lista), **2 Alkulehti**
   (julkiset isoina kortteina etusivun alaosassa) vai **3 Oma sivu**
   (Etusivun alla kuten *Agentin käytössä*, kortit keskusteluittain ja
   esikatselu paneelissa)?
2. Riittääkö näkymälle `</>`-merkki, vai haluatko oikean kuvan? Kuva
   vaatisi hostiin uuden kuvanoton, käytännössä otsattoman selaimen.
3. Riittääkö, että poistettu osoite katoaa listalta, vai pitäisikö
   poistoista jäädä jälki? Jälki olisi uusi tallennettava tieto.

**Suositus:** 3 Oma sivu. Jaettu on asia, jonka annat muille, ei
asetus. Oma sivu Etusivun alla löytyy samasta paikasta kuin *Agentin
käytössä*, kortti on sama kuin keskustelussa, ja paneeli antaa oikean
esikatselun myös näkymille ilman uutta hostin kuvanottoa. 1 on halvin ja
hyvä hallintaan, mutta jättää jaetut asetusten sekaan. 2 kilpailee
etusivun keskustelujen kanssa ja jää alas. Näkymän kuvaksi riittää
`</>`-merkki, eikä poistoista kannata pitää kirjaa.

## Jarin päätös (9.11.2026)

Suunta **3 Oma sivu** (Jaetut-sivu Etusivun alla, kortit keskusteluittain,
esikatselu paneelissa). Kysymyksiin 2–3 suosituksen mukaan: näkymälle
`</>`-merkki, poistoista ei jälkeä. Jari haluaa riffata sivun ulkoasua
seuraavilla kierroksilla ennen toteutusta.
