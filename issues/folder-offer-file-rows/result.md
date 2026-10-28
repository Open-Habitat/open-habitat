# Tulos: kansiotarjouksen tiedostorivit (Leijuva)

`FileShelf` (`web/src/components/FileOffer.tsx`, `FileOffer.css`) toteuttaa
suunnan Leijuva:

- Yläreunan iso esikatselu (`file-shelf-detail`) ja "valittu tiedosto"
  poistuivat, samoin `ShelfPane`n ensimmäisen tiedoston automaattinen valinta
  (`ViewHost.tsx`). Kortista avattu paneeli vierittää kerran kortin tarjouksen
  kohdalle, kun sen yläpuolella olevat tarjoukset ovat latautuneet.
- Rivi on painike (nimi = tiedoston nimi ja koko), joka avaa esikatseludialogin
  (`OfferedFilePreview`). Lajille, jota selain ei osaa näyttää, dialogi näyttää
  tyypin, koon ja Lataa-painikkeen.
- Rivin omat painikkeet: silmä (nimi `<lajin teko>: <tiedosto>`, esim. *Näytä
  isona: kaavio.png*; ei lajille `file`) ja lataus (`Lataa: <tiedosto>`). Ne
  tulevat koon paikalle osoittimella ja näppäimistön fokuksella
  (`:has(:focus-visible)`), ja Tab kulkee rivistä niihin.
- Harmaa tausta on vain hoverissa. Fokus ei piirrä taustaa, joten klikkaus ja
  esikatselun sulkeminen eivät jätä riviä harmaaksi; näppäimistön fokus näkyy
  rivin reunuksena.
- Kosketuksella (`hover: none`) ja puhelinleveydellä (≤ 800 px) painikkeet
  näkyvät aina, koko siirtyy nimen alle ja rivi on 48 px.

Selaintesti `web/tests/agent-file-offers.spec.ts` (paketti- ja puhelintesti)
kattaa: ei isoa esikatselua, painikkeet piilossa ilman osoitinta ja näkyvissä
hoverilla, rivin lataus omalla nimellään, rivin painallus avaa dialogin, rivin
tausta läpinäkyvä sulkemisen jälkeen, Tab rivistä painikkeisiin ja Enter
esikatseluun, axe, puhelimessa painikkeet aina ja koko nimen alla, ja
vieritys vanhemman tarjouksen kohdalle. Kuvat `evidence/` (DSF 2, vaalea ja
tumma, työpöytä ja puhelin; `-osoitin` = hover, `-esikatselu` = dialogi).

## Päätökset myöhempää tarkistusta varten

- **Kansiot pysyivät litteinä ryhminä.** Prototyypin sisäkkäinen, avattava
  kansiopuu (Jarin kysymys 2) ei kuulunut valittuun suuntaan eikä tämän
  issuen kuvaukseen, eikä Jari vastannut siihen. Vaihtoehto: tehdä puu nyt.
  Jätin sen pois, koska se on oma muutoksensa, joka koskee kaikkia suuntia;
  sen voi tehdä erikseen, jos Jari haluaa.
- **Painikkeet näkyvät aina myös kapeassa (≤ 800 px) ikkunassa hiirelläkin.**
  Vaihtoehto: vain `hover: none`. Prototyyppi käytti puhelinleveyttä, ja sama
  raja kasvattaa sovelluksen rivikontrollit 40 px:iin; kapeassa ikkunassa
  piilotettu lataus olisi vaikeampi löytää.
- **Silmäpainikkeen saavutettava nimi on lajin teko ja tiedoston nimi**
  (*Lue: LUE MINUT ä.txt*), ja `title` on lajin teko. Prototyypin päätös.
- **Rivin painallus avaa dialogin myös lajille `file`.** Dialogi näyttää
  tyypin, koon ja Lataa-painikkeen, joten rivi ei ole koskaan kuollut.
- **Vieritys kortin tarjoukseen tehdään kerran avausta kohden.** Saman kortin
  *Näytä tiedostot* uudelleen paneelin ollessa auki ei vieritä uudelleen.
