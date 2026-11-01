# Näkymäkortti, kierros 2: opas

Avaa `nakymakortti-r2.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Ylhäällä on valitsin (näppäimet 1–4 tai ←/→):

- **Lähtö · kierroksen 1 suunta 3** on valitsemasi suunta sellaisenaan.
- **A · Valikko otsikkorivillä**, **B · Kytkin otsikkorivillä** ja
  **C · Valitsin painikerivillä** ovat riffit.

Yläosan valinnoilla vaihdat teeman, laitteen, sen salliiko sivusto linkit, ja
otsikon. Riffeissä on lisäksi valinta **Osoite**: *1 · Syntyy julkaistessa*
tai *2 · Pysyvä osoite*. Ne ovat ne kaksi tapaa toteuttaa "yksi osoite",
joiden välillä sinun pitää valita (`../result.md`). Kortti näyttää kummassakin
samalta; ero näkyy sivun alareunan harmaalla rivillä, joka kertoo, minkä
osoitteen selain avaisi tai kopioisi ja kuka sillä pääsee sisään.

## Mikä on kaikissa riffeissä samaa

- Näkymä on alussa **Vain sinä** ja pysyy siinä, kunnes muutat sen.
- **Julkinen** tulee voimaan heti, ilman ikkunaa, 30 päiväksi (sivuston
  enimmäisaika, jos se on lyhyempi). Päivämäärä näkyy säätimessä.
- Julkiseen korttiin tulee painike **Kopioi linkki**.
- **Avaa omalle välilehdelle** avaa julkisen näkymän samaan osoitteeseen,
  jonka Kopioi linkki antaa. Näet siis välilehdellä täsmälleen sen, minkä
  vastaanottaja näkee.
- Takaisin **Vain sinä**: osoite lakkaa toimimasta heti, ilman vahvistusta.
- Paneelin linkkikuvake on nyt *Kopioi linkki*, ja se näkyy vain julkisella
  näkymällä. Näkyvyys vaihdetaan kortista.
- Jos sivusto ei salli linkkejä, säädintä eikä Kopioi linkki -painiketta ole.

## Akseli: millainen säädin on ja missä se on

1. **A · Valikko otsikkorivillä.** Kierroksen 1 pilleri pysyy paikallaan,
   mutta valikossa on vain *Vain sinä* ja *Julkinen*, kummankin alla yksi
   selittävä rivi. Kaksi painallusta.
2. **B · Kytkin otsikkorivillä.** Otsikkorivin oikeassa reunassa on kytkin
   *Julkinen*. Yksi painallus. Yksityisestä näkymästä ei sanota muuta kuin
   kytkimen asento.
3. **C · Valitsin painikerivillä.** Painikkeiden lopussa on
   *Vain sinä | Julkinen*. Molemmat arvot näkyvät koko ajan, yksi painallus
   vaihtaa. Julkisena rivi on työpöydälläkin liian pitkä ja jakautuu kahdelle
   riville.

## Kokeile näin

1. **Lähtö**: paina toisen kortin *Vain sinä ⌄* › *Kuka tahansa linkillä…*
   › *Luo linkki*. Paina sitten *Avaa omalle välilehdelle* ja katso
   alareunasta, että välilehti ja linkki ovat eri osoitteita.
2. **A, B tai C**: tee toisesta kortista julkinen. Paina *Kopioi linkki* ja
   *Avaa omalle välilehdelle*: osoite on sama.
3. Tee se taas yksityiseksi ja sitten julkiseksi. Valinnalla *1 · Syntyy
   julkaistessa* osoite on uusi; valinnalla *2 · Pysyvä osoite* sama vanha
   osoite toimii taas kaikilla, joilla se on tallessa.
4. Kokeile puhelimessa: A:n pilleri siirtyy otsikon alle, B:n kytkin pysyy
   otsikkorivillä, C:n valitsin on oma rivinsä.

Suosittelen riffiä **B · Kytkin otsikkorivillä** ja osoitemallia **1 ·
Syntyy julkaistessa**. Perustelut, hostin tiedot ja arkkitehtuurikysymys
ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen
skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`. Kuvat ja konsolitarkistus:
`NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`, sen jälkeen
`python3 scripts/screenshots-to-avif.py <hakemisto>/kuvat`.
