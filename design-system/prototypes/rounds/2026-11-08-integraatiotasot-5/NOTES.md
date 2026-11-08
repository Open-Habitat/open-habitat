# Integraatioiden tasot – kierros 5

Issue `proto-integration-levels`. Jari valitsi kierrokselta 4
(`../2026-11-08-integraatiotasot-4/`) **Jokainen kokonaan** -suunnan, mutta
ohjeen pitää ohittaa jo tehdyt tasot, tai henkilö valitsee alussa, mitkä
neljästä tasosta hän nyt asettaa. Aloitukseen tulee myös vertailutaulukko.
Tämä kierros riffaa aloitusnäkymää ja ensimmäisiä askelia. Näkymä on
ylläpitäjän Asetukset › Palvelinintegraatiot ja dialogi *Microsoft 365:
tasojen sovellukset*. Palvelin, tilit ja tunnukset ovat synteettisiä.

## Suunnat yhdellä rivillä

Akseli: miten aloitus näyttää tasot ja miten asetettavat valitaan.

1. **Rastit taulukossa**: aloitus on vertailutaulukko. Jokaisen asettamattoman tason sarakkeessa on rasti *Aseta nyt*, ja asetetuissa sarakkeissa lukee *Asetettu*. *Aloita* käy rastitetut läpi.
2. **Taulukko valitsimena**: sama taulukko, mutta asettamattoman tason sarake on itse painike. Sen painaminen aloittaa juuri sen tason, ja tallennuksen jälkeen palataan taulukkoon.
3. **Tilalista**: aloitus on neljän tason lista, jossa näkyy asetettu / ei asetettu sekä kuka ja milloin. Jokaisella puuttuvalla rivillä on *Aseta*, ja taulukko on *Mitä tasot sallivat* -painikkeen takana.

Suositus: **Rastit taulukossa** (perustelu issuen `result.md`:ssä).

## Mikä on kaikissa kolmessa sama

- **Lähtötila** on Jarin tilanne: yksi taso on tehty klikkaamalla
  (*Täysi*, tallentanut @kaisa-admin 7.11.), *Vain luku* on asetettu
  palvelimella (root kirjoitti tiedostoon), ja kaksi tasoa puuttuu.
  Yläpalkin *Ei tunnuksia* näyttää tilan, jossa mitään ei ole asetettu.
- **Miten host tietää.** Taso on asetettu, kun palvelimen
  integraatiotiedostossa on sille käytettävät tunnukset. Selain lukee ne jo
  nyt (`GET /api/v1/server/integrations`). Aloituksessa näkyy jokaisen
  asetetun tason rivi samassa muodossa kuin tuotannon tunnusrivi:
  *Microsoft Entra · client id 4f2c9a1e-… · 7.11.2026 · @kaisa-admin*, tai
  *asetettu palvelimella*, kun root kirjoitti sen.
- **Asetettua tasoa ei tehdä uudelleen.** Sitä ei voi valita, eikä se ole
  läpikäynnissä. Sovellusrivillä ovat vain valitut tasot, ja sen vieressä lukee
  *Ei tässä asetuksessa: Täysi, Vain luku* (puhelimessa *+2 ohitetaan*).
- **Läpikäynti on kierroksen 4 Jokainen kokonaan**: 17 kohtaa sovellusta
  kohden, oikeat peitetyt Entra-leikkeet (`../2026-11-06-m365-leikkeet/`) ja
  vain alareunan nappi vie eteenpäin. Kuvaamattomat näkymät on nimetty.
  Läpikäynnin ensimmäinen sovellus saa kertaohjeet (App registrations
  -linkki, roolit), oli se mikä taso tahansa.
- **Tenant ID otetaan tallennetulta tasolta.** Kun yksikin taso on
  asetettu, tenanttia ei kysytä, ja kohdassa lukee, miltä tasolta se on.
  Jos mitään ei ole asetettu, tenantti kysytään ensimmäisessä sovelluksessa.
- **Sama client ID** kuin jollain toisella tasolla, myös aiemmin asetetulla,
  hylätään.
- **Takaisin** läpikäynnin ensimmäisestä kohdasta palaa aloitukseen.
  Viimeisen tallennuksen jälkeen dialogi palaa aloitukseen, jossa lukee
  *Tallennettu: …*. Kun kaikki neljä on asetettu, alareunassa on *Valmis*.
- **Sivulla** taulukko on aina *Mitä tasot sallivat* -painikkeen takana,
  koska se on nyt dialogin aloituksessa. Rivin painike on *Luo
  sovellukset…*, *Aseta puuttuvat…* tai kaikkien ollessa asetettuina
  *Tasot*, ja se avaa saman aloituksen.

## Mitä kukin suunta päättää

- **Rastit taulukossa**: yksi näkymä, jossa ovat sekä se, mitä tasot sallivat,
  että valinta. Kaikki puuttuvat ovat valmiiksi rastitettuina, ja
  rastin poistaminen jättää tason myöhemmäksi. Alla on *Aloita: 2 tasoa*,
  ja ilman rasteja *Valitse taso* ei toimi. Valitut käydään läpi yhtenä
  jatkumona (*Tallenna ja jatka: Luonnokset*).
- **Taulukko valitsimena**: aloitusnappia ei ole. Asettamattoman tason
  sarakkeen otsikossa on *Aseta*, ja koko sarake syttyy osoittimen alla ja
  on klikattava. Taso tehdään kerrallaan, ja tallennus palauttaa
  taulukkoon, jossa sarakkeessa lukee nyt *Asetettu*.
- **Tilalista**: rivillä on tason nimi, yhden lauseen kuvaus siitä, mitä
  taso sallii, tila (*Asetettu* tai *Ei asetettu*) ja asetetulla rivillä
  kuka ja milloin. Rivin *Aseta* tekee yhden tason, ja alareunan *Aseta
  puuttuvat (2)* tekee kaikki puuttuvat. Taulukko on piilossa, kunnes sen
  avaa. Aloitus on lyhyin ja mahtuu puhelimeen parhaiten.

## Yläpalkki

Työpöydällä yläpalkissa ovat kaikkien kolmen suunnan rivit (valittu
lihavoituna) ja *Kaikissa*-rivi. Puhelimessa näkyy vain valitun suunnan rivi.
*Alusta (2/4)* palauttaa lähtötilan ja avaa dialogin. *Ei tunnuksia*
näyttää tilan, jossa mitään ei ole asetettu. *Täytä tunnukset* täyttää
puuttuvat esimerkkitunnukset, ja *Näytä asetettu* näyttää sivun, jolla kaikki
neljä on asetettu. Dialogi on auki, kun sivu avataan.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-08-integraatiotasot-5/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-integraatiotasot-5/check.mjs \
  design-system/prototypes/dist/integraatiotasot-5/levels.html <kuvahakemisto>
```

`check.mjs` tarkistaa ensin kierroksen 3 leikkeet kuten kierros 4. Sitten se
ajaa kaikki kolme suuntaa koossa 1440×900 ja 390×844, vaaleana ja tummana.
Aloituksessa se tarkistaa taulukon (Tilalistassa painikkeen takana),
asetetut tasot, tunnusrivit ja sen, että vain puuttuvia voi valita. Se käy
valitut tasot läpi pelkällä alanapilla (16 painallusta sovellusta kohden)
ja tarkistaa, ettei tenanttia kysytä. Se tarkistaa myös, että tyhjä tallennus
ja toisen tason client ID hylätään ja että tallennuksen jälkeen palataan
aloitukseen. Lisäksi se kokeilee, että Takaisin vie aloitukseen ja että ilman
tunnuksia tenantti kysytään. Läpikäynnin dialogin on mahduttava näkymään
vierittämättä, ja aloituksen alareunan on pysyttävä näkyvissä.
Tarkistuspisteitä on 2924, ja konsoli pysyy puhtaana.
