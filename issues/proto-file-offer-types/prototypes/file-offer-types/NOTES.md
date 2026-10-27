# Agentin tiedosto ihmiselle · Kierros 2: tiedostotyypit

Valitsit kierroksella 1 Kortin. Tämä kierros katsoo, miten sama kortti
esittää ne tiedostotyypit, joiden esitystä pitää miettiä. Monen tiedoston
käsittely on oma kierroksensa (`proto-file-offer-many`), joten tässä
jokainen tiedosto on omassa kortissaan.

Keskustelussa *Kevätkampanjan aineisto* (työtila `kevatkampanja`) agentti
tekee kampanjan aineiston neljässä vuorossa:

1. klo 13.09: pystykuva `juliste-a2.png` (3000 × 4500, 8,4 Mt), `logo.svg`
   ja animoitu `latautuu.gif`
2. klo 13.21: video `intro.mp4` (0:05) ja ääni
   `radiospotti-selostus.m4a` (0:34)
3. klo 13.38: `tiedote.md`, `tiedote.docx`, `hallitus-esitys.pptx`
   (12 diaa) ja `esite.pdf` (4 sivua)
4. klo 13.52: `ilmoittautuneet.csv` (1 248 riviä), `muistutukset.py`,
   `reittikuvat.zip` (24 tiedostoa kansioittain) ja
   `osallistujat.parquet`, jota selain ei osaa näyttää

Nimet ja luvut on keksitty. Video ja ääni ovat oikeasti soitettavia:
video on viiden sekunnin animaatio ja ääni puheen rytmiä jäljittelevä
äänitys. Prototyypissä video on WebM, koska testiselain ei soita
MP4:ää.

Kierros vertailee yhtä asiaa: **kuinka paljon tiedostosta näkyy kortissa
itsessään.** Kortin runko on kaikissa sama kuin kierroksella 1: *Agentti
tarjoaa ladattavaksi:*, nimi, tyyppirivi (esim. ”Video (MP4) · 0:05 ·
1920 × 1080 · 2,4 Mt · Vain sinulle”) sekä *Lataa* ja toinen painike.
Kuvat näkyvät kortissa kaikissa suunnissa, kuten kierroksella 1 valittiin.

## Kolme suuntaa

| Suunta | Mitä kortissa näkyy | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Tunniste | Kuvan lisäksi vain tyyppi ja tiedot. Tyyppimerkki ja sen väri kertovat lajin: violetti on media, oranssi asiakirja ja vihreä data tai koodi. Toinen painike sanoo, mitä saat: *Toista*, *Kuuntele*, *Lue*, *Esikatsele*, *Selaa dioja*, *Näytä taulukko*, *Näytä koodi* tai *Näytä sisältö*. Sisältö avautuu esikatseluikkunaan. | Kortit ovat tasakorkeita ja lanka pysyy tiiviinä. Vaatii vähiten hostilta: tyyppi ja tiedot riittävät. | Et näe, mitä tiedostossa on, ennen kuin avaat sen. Esimerkiksi tiedotteen ja esitteen erottaa vain nimestä. |
| 2 Kurkistus | Tyypin mukainen, pysähtynyt kurkistus enintään noin 200 px korkeana. Videosta näkyy pysäytyskuva, toistonuoli ja kesto, äänestä aaltomuoto ja kesto. Markdown ja koodi näkyvät alkuriveiltään häivytettyinä, PDF:stä ja Wordista ensimmäinen sivu ja Powerpointista ensimmäinen dia. CSV:stä näkyvät otsikkorivi ja neljä riviä, zipistä kansiot tiedostomäärineen. Gifistä näkyy ensimmäinen kuva ja merkki GIF ▶. Kurkistusta painamalla avautuu esikatselu. | Tunnistat tiedoston yhdellä silmäyksellä, ja lanka pysyy rauhallisena, koska mikään ei liiku eikä soi. | Kortit ovat korkeampia, noin 1,5-kertaisia Tunnisteeseen verrattuna. Selain hakee jokaisesta tiedostosta palan näkyviin tullessa. Ääntä ei voi kuunnella kortissa, vaikka aaltomuoto näyttää soittimelta. |
| 3 Soitin | Kortti on katselin. Video soi kortissa selaimen omilla säätimillä, ääni soittimella, jonka aaltomuotoa voi painaa kohtaan, ja koko tiedote luetaan *Näytä koko tiedote* -painikkeella. Sivuja ja dioja selataan kortissa ‹ › -painikkeilla. CSV on vieritettävä taulukko (40 riviä), koodi on vieritettävä ja korostettu, ja zipin kansiot aukeavat paikallaan. *Näytä isona* avaa saman esikatselun. | Mitään ei tarvitse avata: kuuntelet, katsot ja selaat suoraan keskustelussa. | Vie eniten tilaa: lanka on noin kaksi kertaa Tunnisteen pituinen. Keskustelusta tulee sisältöselain, ja video ja ääni voivat soida, kun vierität pois. Hostilta vaatii eniten. |

Tuntematon tyyppi (`.parquet`) on kaikissa sama: tyyppirivi, lause ”Selain
ei osaa näyttää .parquet-tiedostoa. Lataa se ja avaa omalla
ohjelmallasi.” ja pelkkä *Lataa*.

Esikatseluikkuna on kaikissa suunnissa sama kuin kierroksella 1 ja
tuotannon liitteissä. Siihen on lisätty uudet lajit: video säätimineen,
äänisoitin, Markdown luettavana, CSV taulukkona (60 ensimmäistä riviä),
korostettu koodi rivinumeroineen ja zipin sisällysluettelo. Zipistä ei
voi avata yksittäistä tiedostoa. Puhelimessa ikkuna täyttää ruudun.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-file-offer-types/prototypes/file-offer-types/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Suuntaa vaihdetaan
alareunan valitsimella tai näppäimillä **1–3** ja **←/→**. Yläreunasta voi
vaihtaa teeman ja puhelinleveyden.

1. **Tunniste**: paina videon *Toista* ja äänen *Kuuntele*. Avaa CSV ja
   zip. Riittääkö pelkkä tyyppirivi kertomaan, mikä tiedosto on mikin?
2. **Kurkistus**: vieritä koko keskustelu läpi. Tunnistatko tiedoston
   kurkistuksesta? Paina videon pysäytyskuvaa ja zipin listaa.
3. **Soitin**: soita ääni kortissa ja paina aaltomuodon keskikohtaa. Selaa
   esitys diaan 3 ja avaa zipistä yksi kansio. Onko lanka vielä luettava,
   kun kaikki on auki?

## Kysymykset sinulle

- Saako video tai ääni soida kortissa vai vain esikatselussa? Suosittelen
  Kurkistusta niin, että ääni soi kortissa. Äänellä ei ole kuvaa, joten
  sen kurkistus voi olla soitin. Video soisi silti vasta ikkunassa.
- Riittääkö Officen esikatseluksi selaimen oma hahmonnus? Tuotannon
  esikatselu piirtää docx-, xlsx- ja pptx-tiedostot selaimessa, eikä
  tulos ole aina sivulleen sama kuin Wordissa tai PowerPointissa.
  Tarkka sivukuva vaatisi palvelimelle LibreOfficen, eli uuden ison
  riippuvuuden. En suosittele sitä nyt.
- Animoitu GIF: Kurkistus näyttää sen pysähtyneenä, Tunniste ja Soitin
  pyörittävät sitä. Kumpi?

Kuvat ovat hakemistossa `evidence/` (laitteen skaalaus 2). Jokaisesta
suunnasta on koko keskustelu työpöydällä ja puhelimessa, vaaleana ja
tummana. Lisäksi on esikatselukuvia (video, ääni, Markdown, CSV, zip,
PDF) ja `3-soitin-*-avattu.png`, jossa Soittimen ääni, diat, tiedote ja
zip ovat auki.
