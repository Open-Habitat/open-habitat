# Integraatioiden tasot – kierros 4

Issue `proto-integration-levels`. Jari valitsi kierrokselta 3
(`../2026-11-06-integraatiotasot-3/`) **Sovellus kerrallaan** -suunnan.
Yksi komento -suunta putosi pois, koska Cloud Shell vaatii Azure-tilauksen
ja tavallisella Microsoft 365 -tenantilla sitä ei ole (Jarin kuvat 8.11.,
`issues/proto-integration-levels/evidence/jari-2026-11-08-cloud-shell-*.png`).
Ohje on nyt pelkkä klikkauspolku Entrassa. Näkymä on ylläpitäjän
Asetukset › Palvelinintegraatiot ja dialogi *Microsoft 365: luo
sovellukset*. Palvelin, tilit ja tunnukset ovat synteettisiä.

## Suunnat yhdellä rivillä

Akseli: miten neljä sovellusta käydään läpi klikkaamalla.

1. **Jokainen kokonaan**: kierroksen 3 Sovellus kerrallaan ilman Cloud Shelliä. Jokaisessa neljästä sovelluksesta käydään läpi samat 17 kohtaa, ja tunnukset tallentuvat kunkin lopussa.
2. **Lyhenevä toisto**: ensimmäinen sovellus käydään läpi kohta kohdalta. Sen jälkeen jokainen vaihe on yksi sivu, jossa korostuu vain se, mikä eroaa edellisestä (nimi, oikeudet, tunnus).
3. **Tarkistuslista**: dialogin vasemmassa reunassa on lista neljästä sovelluksesta vaiheineen, ja vain meneillään oleva on auki. Rasti kertoo, mikä on tehty ja tallennettu.

Suositus: **Lyhenevä toisto** (perustelu issuen `result.md`:ssä).

## Mikä on kaikissa kolmessa sama

- **Ei Cloud Shelliä.** Komentoa, *Tee käsin* -painiketta ja Cloud
  Shell -ohjetta ei ole.
- **Vain oikeita leikkeitä.** Kaistaleen kuvat ovat `proto-m365-setup-flow`-kierroksen
  3 peitettyjä leikkeitä (`../2026-11-06-m365-leikkeet/crops/`), eikä tähän
  hakemistoon tule kuvia. Jos alakohdan näkymästä ei ole kuvaa, kaistaleen alla
  lukee **Kuva puuttuu:** ja näkymän nimi. Kaistaleessa näkyy silloin se kuvattu
  sivu, josta näkymä avautuu, ja valo on napissa, joka sen avaa. Kuvaa
  puuttuu neljästä näkymästä:
  - *Add Redirect URI › Mobile and desktop applications* -paneeli
  - *Request API permissions* -paneeli (Microsoft Graph › Delegated permissions)
  - *Select permissions* -haku ja *Add permissions*
  - *Grant admin consent* -vahvistus (*Yes*)
- **Yksi nappi (A1b5).** Vain alareunan nappi vie eteenpäin. Alakohtien
  numerorivi näyttää ainoastaan, missä kohdassa ollaan, eikä sitä voi
  klikata. Sovelluksen voi vaihtaa sovellusrivistä tai listasta.
- **Taulukko** on kierroksen 3: ennen asetusta se on auki Microsoftin rivin
  alla ja sarakeotsikoissa näkyy *Ei tunnuksia* tai *Tarjolla*. Kesken
  jääneessä asetuksessa rivillä lukee *1/4 tasoa tarjolla* ja *Jatka
  asetusta…*. Asetuksen jälkeen taulukko avautuu *Mitä tasot sallivat*
  -painikkeesta. Solu ilman oikeutta on **✕ Ei**.
- **Tallennus jokaisen sovelluksen lopussa.** Tenant ID kysytään vain
  ensimmäisessä tallennettavassa sovelluksessa. Sama client ID kahdelle
  tasolle hylätään, ja virhe kertoo, mille sovellukselle se jo on annettu.

## Mitä kukin suunta päättää

- **Jokainen kokonaan**: kierroksen 3 dialogi sellaisenaan. Yläreunan
  sovellusrivillä näkyy jokaisen sovelluksen kohtien määrä (*17 kohtaa*).
  Painalluksia on 17 sovellusta kohden, yhteensä 68.
- **Lyhenevä toisto**: ensimmäinen sovellus on kohta kohdalta kuten
  suunnassa 1. Toisesta alkaen jokainen vaihe on yksi sivu. Siinä ovat ne
  arvot, jotka on tehtävä itse (nimi kopiointinapilla, osoite, oikeudet), ja
  edelliseen verrattuna samat asetukset rastitettuina muistutusriveinä
  (*Single tenant only*, *Redirect URI tyhjäksi*, *Register*). Oikeussivulla
  edellisestä sovelluksesta poikkeavat oikeudet ovat korostettuina, ja alla
  lukee ero, esim. *Erona sovellukseen Täysi: − Mail.Send*. Hyväksyntä ja
  client ID ovat samalla sivulla. Sovellusrivi kertoo jo alussa, että muut
  ovat lyhyempiä (*17 kohtaa*, *5 kohtaa*…; puhelimessa *17 · muut 5*).
  Ensimmäiseen sovellukseen tarvitaan 17 painallusta ja muihin 4, yhteensä 29.
- **Tarkistuslista**: dialogi on leveämpi (1180 px). Vasemmalla on lista,
  jossa sovellusten nimet ovat Entran niminä. Auki on vain meneillään oleva,
  ja sen alla ovat sen neljä vaihetta rasteineen. Tallennetun sovelluksen
  kohdalla lukee *Tallennettu*. Listasta voi avata minkä tahansa sovelluksen.
  Puhelimessa lista on yksi rivi: auki oleva sovellus vaiheineen ja muut
  numeroina. Painalluksia on 68 kuten suunnassa 1.

## Yläpalkki

Työpöydällä yläpalkissa ovat kaikkien kolmen suunnan rivit (valittu
lihavoituna) ja *Kaikissa*-rivi. Puhelimessa näkyy vain valitun suunnan rivi.
*Alusta* palauttaa tilan ennen asetusta ja avaa dialogin. *Täytä tunnukset*
täyttää esimerkkitunnukset, ja *Näytä asetettu* näyttää sivun, jolla kaikilla
tasoilla on tunnukset. Dialogi on auki, kun sivu avataan. Taulukon näkee
ennen asetusta, kun dialogin sulkee (*Peruuta*).

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-08-integraatiotasot-4/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-integraatiotasot-4/check.mjs \
  design-system/prototypes/dist/integraatiotasot-4/levels.html <kuvahakemisto>
```

`check.mjs` tarkistaa ensin, että leikkeet ovat samat kuin `crops.json`:ssa
ja peitot tasaisia. Se varmistaa myös, ettei hakemistossa ole kuvia eikä
kierroksen koodissa Cloud Shell -reittiä. Sitten se ajaa kaikki kolme suuntaa
koossa 1440×900 ja 390×844, vaaleana ja tummana. Jokaisessa suunnassa se
käy ensimmäisen sovelluksen läpi pelkällä alanapilla, tarkistaa tyhjän
tallennuksen hylkäyksen ja siirtyy toiseen sovellukseen kysymättä tenanttia
uudelleen. Painallusten määrä tarkistetaan. Jokaisessa alakohdassa
kaistaleella on oltava yksi kohdevalo juuri tämän alakohdan kohteessa,
kuvaamattoman näkymän on oltava nimetty, ja dialogin on mahduttava näkymään
vierittämättä. Tarkistuspisteitä on 2018, ja konsoli pysyy puhtaana.
