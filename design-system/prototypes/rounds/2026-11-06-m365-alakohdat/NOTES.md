# Microsoft 365: aseta tunnukset – kierros 4 (riffit A1b:stä)

Issue `proto-m365-setup-flow`. Kierroksella 3 (`../2026-11-06-m365-leikkeet/`)
Jari valitsi **A1b Kaistaleen**: dialogin levyinen kaistale Entran oikeaa
sivua ohjeen yläpuolella ja kohdevalo yhdessä kohdassa kerrallaan. Se sopi
tilaan parhaiten, mutta vaiheen rivejä piti vierittää ylös ja alas. Tällä
kierroksella vaihe näyttää yhden alakohdan kerrallaan, ja kaistaleen
kohdevalo seuraa sitä. Jokainen vaihe mahtuu 1440×900-näytölle ilman
vieritystä, ja myös 390×844-puhelimessa. Näkymä on Asetukset ›
Palvelinintegraatiot ja Microsoft 365:n *Aseta tunnukset…* rekisteröinnistä
tallennukseen, vaaleana ja tummana. Kaikki on synteettistä, eikä sivulta
lähde pyyntöjä.

## Suunnat yhdellä rivillä

Akseli: miten vaiheen alakohtaan päästään ja kuka vie kulkua.

- **A1b1 Välilehdet**: kaistaleen alla on välilehti jokaiselle alakohdalle Entran nimellä. Lukija valitsee vapaasti, ja *Seuraava* vie seuraavaan vaiheeseen.
- **A1b2 Askeleet**: alakohdat ovat numeroituna askelrivinä, ja yksi *Seuraava*-nappi kulkee alakohta kerrallaan koko ohjeen läpi. Napissa lukee, mikä tulee seuraavaksi.
- **A1b3 Nuolet**: kaistaleen yllä on numeroidut segmentit ja valitun alakohdan nimi, ja kaistaleen kulmassa ovat nuolet. *Seuraava* vie seuraavaan vaiheeseen.

## Mikä on kaikissa kolmessa sama

- **Alakohdat.** Kierroksen 3 rivit on ryhmitelty alakohdiksi, ja jokaisella
  alakohdalla on oma paikkansa leikkeessä. Rivit, joilla ei ollut omaa
  paikkaa, liitettiin sen alakohdan alle, jonka sivulla ne tehdään:
  redirect-osoite on *Add Redirect URI* -kohdassa, *Allow public client flows*
  on *Settings*-kohdassa ja oikeuslista on omassa kohdassaan.
  - Rekisteröi: New registration, Name, Supported account types, Redirect URI, Register, Valmis.
  - Julkinen asiakas: Authentication (Preview), Add Redirect URI, Settings, Valmis.
  - Käyttöoikeudet: API permissions, Add a permission, Oikeudet (9), Valmis.
  - Hyväksyntä ja tunnukset: Grant admin consent, Overview, Application (client) ID, Directory (tenant) ID.
- **Valmis, kun -rivi on vaiheen viimeinen alakohta**, ja kaistale näyttää,
  miltä valmis näyttää. Rekisteröinnin jälkeen se näyttää sovelluksen
  valikon, jossa Overview on valittuna. Julkisen asiakkaan jälkeen se näyttää
  kaksi välilehteä ja oikeuksien jälkeen *Microsoft Graph (1)* -rivin, joka
  pitää lukea (10). Hyväksynnän Valmis, kun -rivi on Grant-kohdassa, koska
  sen jälkeen siirrytään toiselle sivulle (Overview).
- **Kaistaleen korkeus pysyy vaiheen sisällä samana**: työpöydällä
  kuvasuhde on 3,7:1 ja puhelimessa 2,3:1. Näkymä rajataan kohteen ympäriltä
  tähän muotoon, joten ohje kaistaleen alla ei hypi alakohtaa vaihdettaessa.
  Työpöydällä rajaus alkaa leikkeen vasemmasta reunasta, joten sovelluksen
  valikko näkyy, ja teksti on suunnilleen Entran omaa kokoa.
- **Oikeudet ovat siruja**: jokainen siru on yksi kopiointinappi, jossa on
  koko nimi ja kopiointikuvake. Yhdeksän oikeutta mahtuu työpöydällä kolmelle
  riville ja puhelimessa viidelle (kaksi rinnakkain). Valintaruutuja ei ole,
  ja jokainen kopio on yksi nimi. Entran kuvaus näkyy vihjeenä (`title`).
- **Tunnuskentät ovat omissa alakohdissaan** Overview-leikkeen oman rivin
  alla. Jos *Tallenna* löytää virheen, se avaa sen kentän alakohdan.
  Hyväksyntälinkki on Grant-kohdassa roolin vieressä ja täyttyy, kun
  tunnukset on liitetty.
- Kierroksen 3 ohjeteksti ja leikkeet ovat muuten ennallaan. Leikkeet
  luetaan suoraan kierroksen 3 hakemistosta (`crops/`, `crops.json`), eikä
  tähän hakemistoon tule yhtään kuvaa. Tumma teema himmentää kaistaleen
  kuten kierroksella 3.

## Mitä kukin riffi päättää

- **A1b1 Välilehdet**: Välilehdet ovat kaistaleen alla, ja niissä ovat
  Entran sanat ja numero. Valittu välilehti on pehmeä korostepinta ja sillä
  täysi viiva. Nuolinäppäimet, Home ja End liikkuvat listassa kuten missä
  tahansa välilehtilistassa. Valmis-välilehdellä on rasti numeron tilalla.
  Puhelimessa vain valitulla välilehdellä on nimi, ja muut ovat numeroita,
  joten kaikki mahtuvat yhdelle riville. Lukija voi hypätä mihin tahansa
  kohtaan. *Seuraava* vaihtaa vaihetta, joten alakohdan voi myös ohittaa.
- **A1b2 Askeleet**: Askelrivi on kaistaleen alla. Ohitetuissa kohdissa on
  rasti ja nykyisessä korosteväri, ja kohtaa voi myös klikata. Ainoa
  päänappi kulkee alakohdittain (*Seuraava: Name*, … *Seuraava vaihe*), ja
  *Takaisin* palaa kohdan kerrallaan, myös edellisen vaiheen viimeiseen
  kohtaan. Ylhäällä oleva edistymispalkki täyttyy alakohdittain. *Tallenna*
  tulee näkyviin vasta viimeisessä kohdassa. Kapeassa ikkunassa vain
  nykyisellä kohdalla on nimi.
- **A1b3 Nuolet**: Kaistaleen yllä on numeroitu segmenttivalitsin ja sen
  vieressä valitun kohdan nimi. Kaistaleen oikeassa alakulmassa on ‹ ›.
  Ohjeen tilalla kaistaleen alla on vain valitun kohdan teksti, joten tämä on
  kolmesta riffistä tiivein. Nuolet ovat kulmassa, koska kaistale keskittää
  kohteen pystysuunnassa, joten kulma peittää sitä vähiten. Puhelimessa
  keskelle sijoitetut nuolet peittivät kohteen.

## Yläpalkki

Yläpalkissa näkyy vain valitun riffin kuvaus, koska kolme riviä veisi
900 px:n korkeudesta liikaa. *Taso* (Täysi pääsy, Luonnokset, Vain luku)
vaihtaa sovelluksen nimen ja oikeudet ja aloittaa alusta. Palkissa ovat myös
*Teema* ja *Alusta*, ja alhaalla oleva valitsin vaihtaa riffiä (myös
näppäimillä 1–3). *Minulla on jo sovellus* vie kaikissa riffeissä kolmeen
kohtaan: hakukenttä, client ID ja tenant ID.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-m365-alakohdat/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-m365-alakohdat/check.mjs \
  design-system/prototypes/dist/m365-alakohdat/m365.html <kuvahakemisto>
```

`check.mjs` tarkistaa ensin kierroksen 3 leikkeet samoin kuin kierroksen 3
oma tarkistus: sha256 vastaa `crops.json`ia, alkuperäisen kuvan kokoa ei ole,
PNG-tiedostoja ei ole ja jokaisen peiton sisällä on vain peittoväriä. Lisäksi
se varmistaa, ettei tässä hakemistossa ole yhtään kuvatiedostoa. Sen jälkeen
se käy jokaisen riffin jokaisen vaiheen jokaisen alakohdan läpi riffin omalla
ohjaimella (välilehti tai nuolinäppäin, *Seuraava* tai kaistaleen nuoli)
1440×900 ja 390×844 vaaleana ja tummana (kerroin 2). Jokaisessa kohdassa se
tarkistaa seuraavat asiat: dialogi mahtuu näkymään eikä vieritä,
kaistaleella on yksi kohdevalo juuri tämän alakohdan kohteessa, kaistaleen
korkeus pysyy vaiheen sisällä samana, valikkopolku on leipätekstin
kokoinen ja täyttä mustetta, ja linkki on vain ensimmäisessä kohdassa. Lisäksi
oikeuksilla ei ole valintaruutuja ja jokainen kopioi yhden nimen, tyhjä
tallennus avaa client ID:n kohdan, ja A1b2:n Takaisin ylittää vaiheen rajan.
Vain luku -tasolla oikeuksia on 8 ja lukema on *Microsoft Graph (9)*.
Tarkistuspisteitä on 2076, ja konsoli pysyy puhtaana.
