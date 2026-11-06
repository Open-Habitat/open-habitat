# Integraatioiden tasot – kierros 3

Issue `proto-integration-levels`. Jari valitsi 6.11. kierroksen 2
(`../2026-11-06-integraatiotasot-2/`) **Vertailutaulukon**, ja solu ilman
oikeutta on lyhyesti ✕ Ei. Taulukko ei kuitenkaan saa näkyä koko ajan:
kun asetus on tehty, sen pitää avautua erikseen. Lisäksi Microsoftin neljä
Entra-sovellusta, yksi kutakin tasoa kohden, pitää rakentaa **yhdessä
yhteisessä työnkulussa**. Työnkulku on `proto-m365-setup-flow`-kierroksen 4
(`../2026-11-06-m365-alakohdat/`) dialogi: oikeista Entra-leikkeistä tehty
kaistale, yksi alakohta kerrallaan ja A1b2:n mukaisesti yksi nappi, joka kulkee
alakohdat läpi. Näkymä on ylläpitäjän Asetukset › Palvelinintegraatiot.
Palvelin, tilit ja tunnukset ovat synteettisiä.

## Suunnat yhdellä rivillä

Akseli: missä järjestyksessä neljä sovellusta tehdään.

1. **Sovellus kerrallaan**: kierroksen 4 ohje käydään läpi neljästi, kerran kullekin tasolle. Yläreunassa näkyy, mikä sovellus on menossa, ja kunkin tunnukset tallentuvat sen lopussa.
2. **Vaihe kerrallaan**: jokainen vaihe tehdään kaikille neljälle ennen seuraavaa. Lopuksi kaikki neljä client ID:tä kopioidaan App registrations -listasta kerralla.
3. **Yksi komento**: Entran Cloud Shelliin liitetään yksi komento, joka luo kaikki neljä sovellusta, ja sen tulostama rivi liitetään takaisin. Käsin tehtävä ohje on varalla.

Suositus: **Sovellus kerrallaan**, ja Yksi komento sen rinnalle, jos Jari
hyväksyy Cloud Shellin (perustelu issuen `result.md`:ssä).

## Mikä on kaikissa kolmessa sama

- **Ennen asetusta taulukko on auki.** Microsoftin rivillä lukee *Ei
  tarjolla* ja *Neljä tasoa. Jokainen on Entrassa oma sovelluksensa, ja ne
  luodaan yhdellä kertaa.* Rivillä on yksi painike *Luo sovellukset…*.
  Tasoille ei ole enää omia rivejä eikä omia *Aseta tunnukset…* -painikkeita.
  Rivin alla on vertailutaulukko, ja sen sarakeotsikoissa näkyy jokaisen tason
  tila (*Ei tunnuksia* tai *Tarjolla*). Ylläpitäjä näkee siis, mitä hän on
  rakentamassa, ennen kuin aloittaa.
- **Kesken jäänyt asetus pitää taulukon auki.** Jos osalla tasoista on
  tunnukset, rivillä lukee *1/4 tasoa tarjolla* ja *Jatka asetusta…*, ja
  sarakeotsikko kertoo, millä tasolla tunnukset jo ovat.
- **Asetuksen jälkeen rivi on yhden rivin mittainen.** Siinä ovat nimi,
  tasojen nimet yhdellä rivillä, *Tarjolla* ja *Tunnukset*, ja taulukko
  avautuu rivin alle *Mitä tasot sallivat* -painikkeesta. Googlen ja Dropboxin
  rivit toimivat samoin, jotta kaikki asetetut palvelut näyttävät samalta.
- **Taulukko** on kierroksen 2 Vertailutaulukko: ✓ Kyllä tai ✕ Ei jokaisessa
  solussa, ja palvelun rajat varoitusrivinä oikeuden alla (*Osallistujat
  saavat aina kutsun*, *Jakolinkki voi avautua kenelle tahansa…*).
- **Neljä sovellusta**: *Open Habitat – täysi*, *– ei lähetystä*,
  *– luonnokset* ja *– vain luku*. Oikeudet ovat tuotannon kolmen tason
  oikeudet, ja uudesta tasosta puuttuu vain `Mail.Send`.
- **Kaistale, alakohdat ja oikeussirut** ovat kierroksen 4 omat. Leikkeet
  luetaan kierroksen 3 hakemistosta (`../2026-11-06-m365-leikkeet/crops/`,
  `crops.json`), eikä tähän hakemistoon tule kuvia. Kaksi uutta kohdetta on
  annettu samoissa alkuperäisen kuvan pikseleissä (`EXTRA` `round.tsx`:ssä):
  listan *Application (client) ID* -sarake ja listan rivit.
- **Tunnusten tarkistus** on tuotannon `appErrors` jokaiselle sovellukselle.
  Lisäksi sama client ID kahdelle tasolle hylätään ja kerrotaan, mille
  sovellukselle se jo on annettu.
- **Sulje** keskeyttää työnkulun milloin tahansa, ja jo tallennetut tasot
  säilyvät.

## Mitä kukin suunta päättää

- **Sovellus kerrallaan**: Neljä sovellusta ovat dialogin yläreunassa
  rivinä (*1 Täysi*, *2 Ei lähetystä*…). Valmiissa on rasti, menossa oleva
  on korostettu, ja mihin tahansa voi hypätä. Rivin alla on kierroksen 4
  edistymispalkki tämän sovelluksen neljälle vaiheelle. Sovelluksen viimeinen
  nappi on *Tallenna ja jatka: Ei lähetystä*, joten jokainen valmis taso
  tallentuu heti ja on tarjolla, vaikka loput jäisivät tekemättä. Tenant ID
  kysytään vain ensimmäisestä tallennettavasta sovelluksesta, ja muissa
  kohdassa näkyy jo tallennettu arvo. Yhteen sovellukseen tarvitaan 17
  painallusta tallennus mukaan lukien, neljään 68.
- **Vaihe kerrallaan**: Vaiheet ovat Rekisteröi sovellukset, Julkinen
  asiakas, Oikeudet ja hyväksyntä sekä Tunnukset. Sovellusrivi on vaiheen
  nimen alla, ja se täyttyy vaiheen sisällä. Rekisteröinnissä kaikki neljä
  nimeä näkyvät siruina, ja vuorossa olevan voi kopioida. Myöhemmissä
  vaiheissa jokainen sovellus alkaa alakohdalla *Avaa sovellus*: haku listasta
  nimellä. Hyväksyntä tehdään oikeuksien sivulla sovellus kerrallaan.
  Viimeisessä vaiheessa kaikki neljä client ID:tä kopioidaan App
  registrations -listan sarakkeesta yhdellä kertaa ja tenant ID mistä tahansa
  Overview-sivulta. Tallennus on vasta lopussa, ja läpikulkuun tarvitaan 69
  painallusta.
- **Yksi komento**: Vaiheita on kolme: Avaa Cloud Shell, Aja komento ja
  Liitä tulos. Komento on Azure CLI:tä (`az ad app create`, `permission add`,
  `sp create`, `permission grant`). Se hakee oikeuksien tunnisteet nimellä
  Microsoft Graphin omasta palveluprinsipaalista, joten siinä ei ole yhtään
  käsin kirjoitettua GUIDia. Lopuksi se tulostaa rivin `open-habitat
  tenant=… full=… nosend=… drafts=… read=…`. Liitetty rivi luetaan auki
  tasoittain ✓/✕-listaksi, ja puuttuva taso tai tenant estää tallennuksen.
  *Tee käsin* avaa Sovellus kerrallaan -ohjeen samassa dialogissa.
  Cloud Shellistä ei ole leikettä, joten kaistale on vain viimeisessä
  vaiheessa (lista, jossa sovellukset näkyvät).

## Yläpalkki

Työpöydällä yläpalkissa ovat kaikkien kolmen suunnan rivit (valittu
lihavoituna) ja *Kaikissa*-rivi. Puhelimessa näkyy vain valitun suunnan rivi.
*Alusta* palauttaa tilan ennen asetusta ja avaa dialogin. *Täytä tunnukset*
täyttää esimerkkitunnukset avoimeen dialogiin, ja *Näytä asetettu* näyttää
sivun, jolla kaikilla tasoilla on tunnukset. Dialogi on auki, kun sivu
avataan, joten suuntien ero näkyy heti. Taulukon näkee ennen asetusta, kun
dialogin sulkee (*Peruuta*).

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-integraatiotasot-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-integraatiotasot-3/check.mjs \
  design-system/prototypes/dist/integraatiotasot-3/levels.html <kuvahakemisto>
```

`check.mjs` tarkistaa ensin kierroksen 3 leikkeet ja varmistaa, että tämän
kierroksen omat kohteet ovat leikkeen sisällä ja ettei hakemistossa ole
kuvia. Sitten se ajaa kaikki kolme suuntaa koossa 1440×900 ja 390×844,
vaaleana ja tummana:

- ensimmäinen sovellus loppuun ja tyhjän tallennuksen hylkäys
- toinen sovellus ilman uutta tenant-kysymystä
- välitila 1/4, tila ennen asetusta ja tila asetuksen jälkeen
- Vaihe kerrallaan neljällä sovelluksella ja kahdesti annetun client ID:n hylkäys
- Yksi komento, myös vajaan rivin hylkäys

Jokaisessa alakohdassa se tarkistaa, että kaistaleella on yksi kohdevalo
juuri tämän alakohdan kohteessa ja että dialogi mahtuu näkymään vierittämättä.
Taulukon jokaisessa solussa pitää lukea Kyllä tai Ei. Tarkistuspisteitä on
2743, ja konsoli pysyy puhtaana. Virhetila, jossa kaikki neljä client ID
-kenttää näyttävät virheen, ei mahdu 900 px:n korkeuteen, ja dialogi vierittää.
