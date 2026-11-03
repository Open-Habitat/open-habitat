# Selitystila: jokainen kortti yhdellä tyylillä

Avaa `selitystila-kortit.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Näkymät ovat tuotannon oikeita näkymiä synteettisestä labrasta (sama
sivupalkki, yläpalkki, kenttä, paneelit, pääte, editori, asetukset ja
keskustelun kortit kuin tänään), ja selitystila on piirretty niiden päälle
kierroksen 5 riffin 1 mukaan: näyttö himmenee, kohta osoittimen alla
valaistuu ja kortti tulee sen viereen.

Tämä kierros on teksteistä. Yläreunassa on kolme suuntaa yhdellä rivillä,
ja valitsimesta (näppäimet 1–3) vaihdat niiden välillä:

- **1 Mitä · tiedä · kokeile** (suositus): nimi, yksi lause mitä kohta tekee
  sinulle, yksi lause mitä kannattaa tietää ja Kokeile-painike. Kaikki 178
  korttia on kirjoitettu tällä tyylillä.
- **2 Yksi lause**: nimi ja yksi lause.
- **3 Opastava**: kaksi tai kolme virkettä tilanteesta lähtien, esimerkin
  kanssa.

Suunnat 2 ja 3 on kirjoitettu neljälle kohdalle: Pääte (Y08), Konteksti
(Y05), Hiljaiset (S07) ja komentorivi keskustelussa (K05). Muut kohdat eivät
syty niissä.

## Kaksi sivua

**Selitystila näkymissä** näyttää tilan oikeissa näkymissä. Valitse
*Näkymä*-listasta mikä tahansa 22 näkymästä (keskustelu kortteineen, agentti
työssä, aloitussivu, opas, listat, Git, Tiedot, pääte, editori, workerit,
worker, sivupalkki, tilivalikko, etusivu, työtilan sivu, asetukset), sekä
laite, teema ja korttien kieli.

- Vie osoitin kohdan päälle: kortti tulee. Napsauta: kortti pysyy, ja
  siinä on *Kokeile* ja *Irrota*. Puhelimessa napautus pitää kortin.
- *Kokeile* lopettaa tilan ja avaa tuloksen, jos se on kaapattu (esim.
  Pääte avaa päätteen, Git-tila Git-paneelin). Muuten näytön alareunaan tulee
  ilmoitus, mitä painallus tekisi.
- Esc, palkin *Lopeta* tai uusi painallus Selitä-painikkeeseen lopettaa
  tilan.
- Tilan ulkopuolella painallus avaa kaapatun tuloksen, joten prototyypissä
  voi kulkea näkymästä toiseen.

**Kaikki kortit** on luettava lista: ensin ohjeen tyyli, sitten kolme
suuntaa rinnakkain neljällä kohdalla ja lopuksi jokainen kortti alueittain
suomeksi ja englanniksi. Jokaisella kortilla on tunnus (esim. Y08), johon voi
viitata kommentissa. *Näkyy*-linkki avaa kortin oikeassa näkymässä.

## Mistä tila alkaa

- Ensimmäisen tyhjän keskustelun aloitussivulla on nauha **Mitä näytöllä
  on? · Selitä nämä mulle** (näkymä *Uusi keskustelu*).
- **Tilivalikko › Selitä tämä näkymä** on aina olemassa, jokaisessa
  näkymässä (näkymä *Tilivalikko*). Leveällä näytöllä keskustelun ⋯ puuttuu
  kokonaan, kun kaikki mahtuu riville, joten pelkkä ⋯ ei riitä.
- Puhelimella myös **⋯ › Selitä tämä näkymä** (näkymä *⋯-valikko auki*,
  puhelin).

## Ohjeen tyyli

Kortti kertoo, mitä kohta tekee sinulle, ei miten se on tehty. Nimi on sama
sana kuin näytöllä. Ensimmäinen lause alkaa verbillä (”Avaa…”, ”Näyttää…”),
toinen kertoo yhden asian, joka kannattaa tietää: mikä säilyy, mitä ei
tapahdu, milloin kohta on harmaa tai missä se on puhelimessa. Kokeile on vain
turvallisissa teoissa; arkistoinnissa, poistossa ja uloskirjautumisessa
kortti kertoo, miten teon saa peruttua. Laji ja pikanäppäin ovat kortin
yläreunassa. Sävy on sinä-muoto, rauhallinen ja suora. Näytöllä näkyvät
sanat, kuten Git, commit ja worktree, saavat jäädä, ja kortti kertoo niiden
merkityksen. Asetusrivit kuvaavat jo itsensä, joten kortti on asetussivulla
eikä jokaisella rivillä. Koko sääntö on *Kaikki kortit* -sivun alussa.

## Kokeile näin

1. Avautuessa Pääte on selitetty keskustelussa. Liikuta osoitinta
   yläpalkin, sivupalkin, aikajanan rivien ja kentän yli.
2. Napsauta Git-sirua (↑2 ↓1) ja paina *Kokeile*: Git-paneeli aukeaa. Paina
   *Selitystila: Päällä* ja käy paneelin rivit läpi.
3. Vaihda näkymäksi *Kentän lista: Komennot*: lista peittää keskustelun,
   joten vain sen rivit selittyvät, kuten tuotannossa.
4. Vaihda valitsimesta 2 ja 3 ja katso samat neljä kohtaa.
5. Vaihda *Puhelin 390* ja napauta. Kortti on koko leveä ja pysyy, kunnes
   painat *Irrota* tai napautat muualle.
6. *Kaikki kortit*: lue lista ja merkitse tunnukset, joita haluat muuttaa.

## Rajat

- Näkymien oma käyttöliittymä on suomeksi myös silloin, kun kortit ovat
  englanniksi.
- Labrassa ei ole kontekstin erittelyä eikä mallien luetteloa, joten
  yläpalkin malli on kirjoitettu ”Opus 5.5 · Medium” ja kontekstimittarin
  Kokeile näyttää vain ilmoituksen.
- Käyttäjät ja pääsy (M22), Levytila (M23) ja Työtilan arkisto (T14) ovat
  vierityksen takana; vieritä niin ne selittyvät. Kopioi koodi ja Rivitä
  (K15, K16) ovat suljetun Kaavion lähteen sisällä, ja Ei avointa työtä
  (E07) näkyy vain, kun jollain työtilalla ei ole keskusteluja.

Kuvat ovat hakemistossa `kuvat/` kertoimella 2. Suositus ja kysymykset ovat
issuen `result.md`:ssä.

## Rakentaminen ja tarkistus

Kierroksen lähde on `design-system/prototypes/rounds/2026-11-03-selitystila-kortit/`.
Kortit ovat tiedostossa `cards.mjs`.

```
OH_PORT_BASE=6174 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-selitystila-kortit/capture.mjs
node design-system/prototypes/rounds/2026-11-03-selitystila-kortit/build.mjs
node design-system/prototypes/rounds/2026-11-03-selitystila-kortit/shoot.mjs issues/proto-explain-mode-r6/prototype/kuvat
python3 scripts/screenshots-to-avif.py issues/proto-explain-mode-r6/prototype/kuvat
```

Tarkistus käy läpi jokaisen suunnan, näkymän, leveyden ja suunnassa 1 myös
molemmat teemat: se osoittaa (työpöytä) tai napauttaa (puhelin) jokaista
näkyvää kohtaa, varmistaa, että kohdan saa selitettyä ja kortti pysyy
näkymässä, ja kokeilee Kokeile-, Irrota-, Esc- ja Lopeta-painikkeita, nauhaa,
kulkemista painalluksella ja Kaikki kortit -sivun linkkejä. Tulos: 2388
selitystä 164 näkymäyhdistelmässä, avoimen listan tai valikon peittämiä
kohtia 778, tavoittamattomia 0, näkymän ulkopuolelle meneviä kortteja 0,
konsoli puhdas.
