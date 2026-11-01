# Yläpalkin painikkeet: kuka selittää ja missä

Avaa `opastus.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Valitsimessa on neljä vaihtoehtoa (näppäimet 1–4 tai ←/→). Sivun yläreunassa
lukee yhdellä rivillä, mitä kukin vaihtoehto tekee toisin:

- **Pohja · Kortti kerran tilille**: kierroksen 2 riffi 1. Kortti avautuu
  itsestään ensimmäisessä keskustelussa, ja tili muistaa selitetyt painikkeet.
- **1 · Oma ?-painike**: rivin lopussa on ?, joka näyttää nimen jokaisen
  kuvakkeen alla ja avaa selitykset. Mitään ei avaudu itsestään.
- **2 · Agentti selittää**: viestikentän yllä on ehdotus *Kysy agentilta,
  mitä yläpalkin painikkeet tekevät*. Se kirjoittaa kysymyksen kenttään, ja
  vastauksen antaa keskustelun oma agentti.
- **3 · Aloitussivun nauha**: tyhjän keskustelun aloitussivun yllä on nauha,
  jossa kuvakkeet ovat nimineen, ja painike *Selitä nämä mulle*. Selityksen
  antaa agentti.

Jokaisen ero näkyy heti oletusnäkymässä, eli tilanteessa *Ensimmäinen uusi
keskustelu*: kortti, ?-painike, ehdotus tai nauha.

**Tilanne** on tärkein valinta:

- *Ensimmäinen uusi keskustelu*: ihminen aloittaa ensimmäisen keskustelunsa.
  Keskustelu on tyhjä, joten sen paikalla näkyy työtilan aloitussivu (*Aloita
  tästä*). Valinnalla *Aloitussivu: Ei ole* näet saman työtilassa, jossa
  aloitussivua ei ole.
- *Ensimmäinen keskustelu, jossa on jo työtä*: ihminen avaa ensimmäisenä
  esimerkiksi päätteestä aloitetun keskustelun. Aloitussivua ei näy.
- *Myöhempi uusi keskustelu*: näyttää, mikä opastuksen lopettaa.

Teemaa, laitetta ja ikkunan leveyttä voi vaihtaa. Esittelytekstin alla on
laatikko, jossa lukee, kuka selittää, missä ja milloin, mikä opastuksen
lopettaa ja mitä se vaatii palvelimelta. Sivun lopussa on taulukko kaikista
riffeistä ja tilanteista rinnakkain.

## Mitä on jo olemassa ja mitä tulisi uutta

- Aloitussivu näkyy jo nyt vain **tyhjässä** keskustelussa ja työtilan
  sivulla. Yläpalkki painikkeineen on silloin jo sen yllä. Tilannekatsaus ja
  Uusi otsikko ovat tyhjässä keskustelussa harmaina, ja niiden vihje kertoo
  syyn.
- Tavoite kirjoittaa jo nyt pyynnön kenttään taidon kanssa, ja ihminen
  lähettää sen itse. Riffit 2 ja 3 käyttävät samaa tapaa.
- **Agentti ei tiedä yläpalkista mitään.** Pi ei näe selainta. Jotta se
  osaisi vastata oikein, Habitatin pitäisi antaa sille uusi mukana tuleva
  taito (`open-habitat-ohje`), samalla tavalla kuin daemon nyt asentaa
  aloitussivun taidon.
- Agentin vastaus on pelkkää tekstiä. Se ei voi osoittaa painikkeita, joten
  se kertoo, miltä kukin näyttää. Se ei myöskään tiedä, onko ihmisellä
  puhelin vai kapea ikkuna, joten vastaus kertoo molemmat.

## Kokeile näin

1. **Pohja**: kortti peittää aloitussivun alun. Paina Selvä.
2. **1**: paina ?:tä rivin lopussa. Nimet tulevat kuvakkeiden alle ja
   selitykset kortiksi. Kokeile myös puhelimella ja tilanteessa, jossa on jo
   työtä.
3. **2**: paina ehdotusta viestikentän yllä ja sitten Lähetä. Agentti
   vastaa, ja keskustelu saa nimen. Vaihda tilanteeseen *jossa on jo työtä* ja
   avaa ⋯: kysymys tulee sieltä, ja kentän alla varoitetaan, että vastaus jää
   tähän keskusteluun.
4. **3**: vie hiiri nauhan kuvakkeen päälle. Oikea painike korostuu
   yläpalkissa. Puhelimessa napauta kuvaketta. Paina *Selitä nämä mulle* ja
   Lähetä. Kokeile myös *Aloitussivu: Ei ole*.

Suosittelen riffiä **3 · Aloitussivun nauha** automaattisen kortin tilalle ja
⋯-valikon korttia myöhempää tarvetta varten. Perustelut, se mitä kukin riffi
vaatii palvelimelta ja kolme kysymystä ovat issuen `result.md`:ssä. Kuvat
ovat hakemistossa `kuvat/`, ja ne on otettu laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`. Se upottaa tokenit ja
fontit tiedostosta `page.src.html`. Kuvat ja konsolitarkistus tehdään
komennolla `NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`.
Tarkistus painaa jokaista painiketta ja jokaisen riffin omaa opastusta
jokaisessa riffissä, teemassa, laitteessa, leveydessä, tilanteessa ja
aloitussivun tilassa, ja lähettää riffien 2 ja 3 kysymyksen. Painalluksia
on yhteensä 1472, ja konsoli pysyy puhtaana.
