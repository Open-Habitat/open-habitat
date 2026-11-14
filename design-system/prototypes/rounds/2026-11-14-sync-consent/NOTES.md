# Synkronoinnin pysähdys ja lupa – kierros 1

Issue `bisync-force-needs-consent`. Suunnat, suositus ja päätökset ovat
issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja `AccountSettings`
Tiedot agenteille -osiossaan. Microsoft 365 -kortti on tuotannon
`AccountCard` muuttamattomana; vain pysähdyksen tilasana vaihtuu
(`failure.all_changed` kumpaankin kieleen, koska tuotannon nykyteksti sanoo
"tarkistetaan ja jatketaan"). Kierros piilottaa kortin Kirjaudu uudelleen
-painikkeen ja tuotannon ohjerivin pysähtyneellä rivillä, ks. alla. Omat palat
on koottu tuotannon palasista (`ControlButton`, `Checkbox`, `Icon`,
react-arian ikkuna) ja korttien luokista (`ig-warn`, `ig-notice`, `ig-st`,
`ig-spin`, `ig-grant`). Ne viedään portaalilla oikealle kortille (`useSlot`,
kuten kierroksessa `2026-11-13-github-workflow-scope`). Kortti luetaan
uudelleen tuotannon omalla Tarkista-polulla, kun tila vaihtuu.

Suunnat: A Rivi (pysähdys OneDriven rivillä, laskelma ja lupa ikkunassa),
B Ilmoitus (ilmoitus kortin yläosassa, sama ikkuna) ja C Paneeli (paneeli
rivin alla, laskelma täyttyy siihen, ikkuna vain vahvistaa). `text.ts` on
kierroksen sanasto suomeksi ja englanniksi.
`?s=pysahtyi|lasketaan|eipoistoja|poistoja|kaynnissa|valmis|torjuttu|epaonnistui`
ja `?theme=dark` valitsevat alkutilan. Arviointipalkin "Simuloi: tiedosto
muuttuu laskelman jälkeen" näyttää, miten lupa sidotaan laskelmaan: sen
jälkeen jatkaminen torjutaan. Laskelmat ovat keksittyjä: 16 tiedoston
kansio, jossa agentti muokkasi 14 ja lisäsi 2, ja 240 tiedoston kansio,
josta 212 on poistettu Habitatissa.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-sync-consent/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-14-sync-consent/check.mjs \
  design-system/prototypes/dist/sync-consent/offline.html <kuvahakemisto>
```

`web/node_modules` lukitiedoston mukaan (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen. Tarkistus käy kolme
suuntaa ja kahdeksan tilannetta 1440 ja 390 px:n leveydellä, vaaleana ja
tummana, ja klikkaa katso–laske–jatka–valmis-, peru-, torjunta-, paljon
poistoja- ja kysy agentilta -polut sekä englannin. Konsoli on puhdas.

## What the host would need

Nykytila (`internal/daemon/integrations/passes_linux.go`): `syncLoop` jatkaa
`all_changed`-pysähdyksen itse seuraavalla käynnistyksellä. Se ajaa ensin
kuivaharjoituksen ja sitten `--force`-ajon, jos kuivaharjoitus pysähtyi vain
muuttuneisiin tiedostoihin (`passObserver.forced`, `OPEN_HABITAT_FORCE`).
Kuivaharjoituksen tuloste heitetään pois, eikä ihminen näe mitään.
`passState.Failure` on muistissa oleva havainto, joka unohtuu daemonin
uudelleenkäynnistyksessä.

**Pysähdys ja sen näyttäminen.** `forced()` ja `OPEN_HABITAT_FORCE` poistuvat
automaattisesta polusta. Pysähdys näkyy snapshotissa kuten nyt
(`state: sync_failed`, `failure: all_changed`), ja silmukka toistaa
pysähdyksen joka kierroksella, kunnes ihminen päättää. Toistuva ajo ei muuta
mitään, koska bisync ei päivitä listauksiaan pysähtyessään. Muistissa oleva
havainto riittää: daemonin uudelleenkäynnistyksen jälkeen seuraava ajo
pysähtyy taas ja tila palaa, joten pysyvää tallennetta ei tarvita.
Kaksi tuotannon kohtaa muuttuu:

- `needsSignIn` (`web/src/app/integrations.ts`) pitää nyt jokaista
  `sync_failed`-tilaa paitsi `needs_resync`iä kirjautumisongelmana ja
  tarjoaa Kirjaudu uudelleen -painiketta. Uusi kirjautuminen synkronoisi
  koko kansion uudelleen (resync), mikä on tähänkin pysähdykseen väärä
  vastaus. `all_changed` lisätään poikkeuksiin.
- `failureHelp` ei tunne `all_changed`ia, joten rivillä näkyy nyt
  kiintiöohje (`quotaHelp`). Pysähdys saa oman tekstinsä.

Snapshot ei tarvitse uutta kenttää pysähdyksen näyttämiseen. Laskelma ja
lupa tarvitsevat.

**Laskelma (kuivaharjoitus) pyynnöstä.** Uusi daemon-komento, esimerkiksi
`POST /api/v1/integrations/sync-check` palvelun tunnisteella, ajaa
pysähtyneelle kansiolle saman bisync-komennon `--dry-run --force`-lipuin
(`--force` tarvitaan, jotta kuivaharjoitus kertoo, mitä pakotettu ajo
tekisi, eikä vain pysähdy uudelleen). Ajo tapahtuu silmukan tauon aikana,
koska ajot jakavat natiivin konfiguraation (`syncLoop`). Daemon laskee
tulosteesta luvut puolittain: muuttuneet, uudet ja poistetut kummallakin
puolella, sekä enintään muutaman poistettavan polun näytettäväksi. Tulostetta
ei säilytetä tämän enempää (sama periaate kuin `passOutput`issa). Vastaus on
`{check_id, counted_at, path1: {changed, new, deleted}, path2: {...},
total_files, deleted_sample: [...]}`. Muutos alkaa skeemasta `contracts/v1/`.
Kuivaharjoitus ei muuta mitään, joten se ei tarvitse lupaa. Se on
laskelma, jonka ihminen pyytää.

**Miten lupa sidotaan juuri näytettyyn laskelmaan.** `check_id` on daemonin
muistissa oleva kertakäyttöinen tunniste. Siihen liittyy kummankin puolen
listauksen tiiviste: polku, koko ja muokkausaika jokaisesta tiedostosta
siinä muodossa, jonka kuivaharjoitus näki. Pakotettu ajo
(`POST …/sync-force` tunnisteella `check_id`) toimii näin:

1. Daemon hylkää tuntemattoman, käytetyn tai vanhentuneen tunnisteen
   (esim. yli 15 minuuttia).
2. Se ottaa kansion ajolukon, jolloin silmukka ei aja välissä.
3. Se listaa molemmat puolet uudelleen ja vertaa tiivisteeseen. Jos jokin on
   muuttunut, se torjuu pyynnön ilman muutoksia (kierroksen "Ei jatkettu"),
   ja ihminen katsoo uudelleen.
4. Muuten se ajaa yhden `--force`-ajon ja vapauttaa tunnisteen.

Tämä sulkee nykyisen aukon, jossa kuivaharjoituksen ja pakotetun ajon välissä
tullut massapoisto pääsee toiselle puolelle. Vanha lupa ei kata myöhempää
muutosta. Lupa koskee yhtä ajoa. Seuraava samanlainen pysähdys kysyy taas.
Uudelleenlistaus maksaa yhden listauksen lisää; pilvipuolella se on
Graph-kysely, joka tehdään joka tapauksessa jokaisessa ajossa.

Jäännösriski: pilvipuolen muutos voi silti tulla uudelleenlistauksen ja
ajon väliin (sekunteja). `--force` ohittaa samassa ajossa myös
`--max-delete`n, joten välissä tuleva massapoisto pääsisi läpi. Ikkuna on
nykyistä (kuivaharjoitus ja ajo erikseen, ei vertailua) paljon lyhyempi,
mutta ei nolla. Kierros ei ratkaise sitä (`result.md`).

**Paljon poistoja.** Laskelma, jossa on poistoja, näyttää vahvan varoituksen
ja vaatii erillisen valintaruudun. Kynnyksen päättää selain laskelman
luvuista. Host ei tarvitse omaa luokitusta, koska luvut tulevat hostilta.

**Mitä agentti saa tehdä.** Agentti ajaa samana Unix-käyttäjänä, ja se voisi
jo nyt ajaa rcloneа itse, joten tämä ei ole turvaraja. Kyse on tuotteen
tavasta kysyä. Agentti saa pyytää laskelman (sama daemon-komento CLI:n
kautta, esimerkiksi `habitat sync check onedrive`) ja selittää sen. Se saa
pyytää pakotetun ajon vain tunnisteella, joka on peräisin laskelmasta, jonka
se näytti ihmiselle keskustelussa, ja vasta kun ihminen on vastannut
keskustelussa myöntävästi. Daemon ei voi todentaa, että ihminen sanoi kyllä,
joten tämä on agentin ohje (personal-data-taito), ei pakko. Sitominen
laskelmaan pätee agenttiinkin: jos tiedostot muuttuivat, pyyntö torjutaan.
Agentti ei aja `--force`a suoraan rclonella. Taito sanoo tämän, koska
suora ajo ohittaisi sidonnan. Kysy agentilta -painike avaa keskustelun
valmiilla viestillä. Kierroksessa se on ilmoitus siitä, mitä avautuisi.

**Ei muutoksia valtarajoihin.** Kaikki edellä tapahtuu käyttäjän omassa
daemonissa hänen käyttäjänään. Gateway välittää komennot kuten muutkin
integraatiokomennot, eikä provision-välittäjä ole mukana.
