# Microsoft 365: aseta tunnukset – kierros 5 (yksi Seuraava)

Issue `proto-m365-setup-flow`. Kierroksella 4 (`../2026-11-06-m365-alakohdat/`)
vaihe näytti yhden alakohdan kerrallaan kierroksen 3 kaistaleen alla. Jari:
välilehdet ja *Seuraava*-painike pitää yhdistää, jotta "seuraava" klikataan
vain yhdestä paikasta. Tällä kierroksella jokainen riffi kulkee samalla
tavalla. Seuraava vie seuraavaan alakohtaan ja vaiheen viimeisen jälkeen
seuraavaan vaiheeseen. Takaisin toimii päinvastoin myös vaiheen rajan yli.
Riffit eroavat siinä, missä se yksi eteenpäin vievä ohjain on. Näkymä on
Asetukset › Palvelinintegraatiot ja Microsoft 365:n *Aseta tunnukset…*
1440×900 ja 390×844 vaaleana ja tummana. Kaikki on synteettistä, eikä sivulta
lähde pyyntöjä.

## Suunnat yhdellä rivillä

Akseli: missä on ainoa paikka, josta klikataan "seuraava".

- **A1b4 Polku**: askelrivi on ainoa ohjain. Seuraava kohta on rivissä itse nappina (*Seuraava: Name*), ja ohitettuihin pääsee takaisin klikkaamalla. Alapalkissa ei ole Seuraava-nappia.
- **A1b5 Yksi nappi**: alapalkin *Seuraava: …* kulkee alakohdat ja vaiheet. Välilehdet ovat pelkkä edistymisrivi, jota ei voi klikata.
- **A1b6 Nuoli rivissä**: välilehdet voi valita vapaasti, rivin lopussa on *Seuraava*-nuoli ja alussa ‹. Alapalkissa ei ole Seuraava-nappia.

## Mikä on kaikissa kolmessa sama

- **Ruudulla on aina tasan yksi eteenpäin vievä ohjain**: Seuraava, tai
  aivan lopussa *Tallenna*. Mikään muu nappi ei sano "Seuraava".
  `check.mjs` tarkistaa tämän jokaisessa alakohdassa.
- **Vaiheen viimeisessä alakohdassa** ohjain sanoo, mikä vaihe tulee
  (*Seuraava vaihe: Julkinen asiakas*). A1b6:ssa nuolessa lukee *Seuraava
  vaihe*, ja koko nimi on sen nimilappu.
- **Yläreunan vaihepalkki täyttyy alakohdittain** kaikissa kolmessa, koska
  kaikki kulkevat alakohta kerrallaan.
- **Tallenna on alapalkissa vain viimeisessä alakohdassa** (Directory
  (tenant) ID). Jos tunnus puuttuu, Tallenna avaa sen kentän alakohdan
  kuten kierroksella 4.
- *Minulla on jo sovellus* on alapalkissa ensimmäisessä kohdassa, ja
  *Peruuta* sulkee. Alakohdat, ohjetekstit, kaistale, oikeussirut ja
  tunnuskentät ovat kierroksen 4 sellaisinaan. Leikkeet luetaan kierroksen
  3 hakemistosta (`crops/`, `crops.json`), eikä tähän hakemistoon tule
  yhtään kuvaa.

## Mitä kukin riffi päättää

- **A1b4 Polku**: Rivissä on neljä erilaista kohtaa. Ohitettu kohta on
  rasti, ja sitä klikkaamalla palataan. Nykyinen kohta on korostepallo ja
  nimi. Seuraava kohta on täytetty korostenappi *Seuraava: nimi ›*.
  Myöhemmät kohdat ovat vain numero ja nimi, eikä niitä voi klikata, joten
  eteenpäin pääsee vain yhdestä paikasta. Vaiheen viimeisessä kohdassa
  rivin perään tulee *Seuraava vaihe: …*. Seuraavan vaiheen ensimmäisessä
  kohdassa rivin alussa on ‹ edelliseen vaiheeseen. Ohitettujen kohtien
  nimet ovat vain vihjeenä ja nimilappuna: työpöydällä viisi nimeä ja nappi
  eivät mahtuneet riviin katkeamatta. Puhelimessa vain napilla on sanat, ja
  muut kohdat ovat numeroita.
- **A1b5 Yksi nappi**: Kierroksen 4 A1b2 ilman klikattavia palloja. Rivi
  näyttää välilehdiltä mutta ei ole ohjain: siinä ei ole reunaa,
  hover-tilaa eikä osoitinta. Nykyisen kohdan alla on pehmeä pinta, ja
  ohitetuissa kohdissa on vihreä rasti. Alapalkissa ovat *Takaisin* ja
  *Seuraava: nimi* tutussa paikassa. Hyppimistä ei ole: kohtaan pääsee
  vain kulkemalla.
- **A1b6 Nuoli rivissä**: Kierroksen 4 A1b1:n välilehdet, jotka voi valita
  vapaasti hiirellä tai nuolinäppäimillä. Saman rivin lopussa on
  päänappi *Seuraava ›*, ja alussa ‹. Alapalkissa on vain *Peruuta* ja
  lopuksi *Tallenna*. Puhelimessa nuoli on pelkkä ›-kuvake, koska kuusi
  välilehteä ja sana eivät mahdu 390 px:n riviin.

## Yläpalkki

Yläpalkissa näkyy valitun riffin kuvaus. *Taso* (Täysi pääsy, Luonnokset,
Vain luku) vaihtaa sovelluksen nimen ja oikeudet ja aloittaa alusta.
Palkissa ovat myös *Teema* ja *Alusta*, ja alhaalla oleva valitsin vaihtaa
riffiä (myös näppäimillä 1–3).

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-m365-seuraava/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-m365-seuraava/check.mjs \
  design-system/prototypes/dist/m365-seuraava/m365.html <kuvahakemisto>
```

`check.mjs` tarkistaa ensin kierroksen 3 leikkeet kuten kierroksilla 3 ja 4:
sha256 vastaa `crops.json`ia, alkuperäisen kuvan kokoa ei ole, PNG-tiedostoja
ei ole ja jokaisen peiton sisällä on vain peittoväriä. Lisäksi tässä
hakemistossa ei saa olla yhtään kuvaa. Sitten se kulkee jokaisen riffin läpi
alusta tallennukseen painamalla vain sitä yhtä eteenpäin vievää ohjainta.
Ajo tehdään 1440×900 ja 390×844, vaaleana ja tummana, kertoimella 2.
Jokaisessa alakohdassa se tarkistaa seuraavat asiat:

- eteenpäin vieviä ohjaimia on tasan yksi, eikä mikään muu nappi sano
  Seuraava
- dialogi mahtuu näkymään vierittämättä
- kaistaleella on yksi kohdevalo oikeassa kohteessa, ja sen korkeus pysyy
  vaiheen sisällä samana
- valikkopolku on leipätekstin kokoinen
- linkki on vain ensimmäisessä kohdassa

Riffikohtaisesti tarkistetaan, että A1b4:n myöhemmät kohdat eivät ole
nappeja ja ohitettu kohta palauttaa, että A1b5:n rivissä ei ole mitään
painettavaa ja että A1b6:n välilehdet hyppäävät ja nuolinäppäin liikkuu.
Lisäksi Takaisin ylittää vaiheen rajan kaikissa kolmessa, tyhjä tallennus
avaa client ID:n kohdan ja Vain luku -tasolla oikeuksia on 8. Tarkistuspisteitä
on 2760, ja konsoli pysyy puhtaana.
