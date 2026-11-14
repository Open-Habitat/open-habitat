# Microsoftin kansiovalinta ja koot – kierros 1

Issue `microsoft-first-sync-over-quota-and-channel-site-skip`. Suunnat,
suositus ja päätökset ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja `AccountSettings`
Tiedot agenteille -osiossaan, ja sen päällä tuotannon `ConnectDialog`
Microsoftin kansiovaiheessa. A syöttää tuotannon `FolderStep`ille kokoja
(`bytes`, `estimated`, `measuring`) eikä muuta näkymää. Ainoat lisäykset ovat
hylkäyksen tarvittu/vapaa-rivi ja avautumattomien sivustojen sanat. B ja C
piilottavat tuotannon luettelon, mittarin ja painikkeet ja vievät omansa
portaalilla samaan ikkunaan (`useSlot`, kuten kierroksessa
`2026-11-13-github-workflow-scope`). Omat palat on koottu tuotannon
palasista (`Checkbox`, `ControlButton`, `Icon`) ja kansiovaiheen luokista
(`ig-folders`, `ig-folder`, `ig-room`, `ig-quota`, `ig-meta`, `ig-row`).
Laskenta näytetään tuotannon omana `completing`-näkymänä edistymisineen.

react-aria tekee kaiken modaalin ulkopuolisen inertiksi ja tulkitsee sen
painallukset ikkunan ulkopuolisiksi. Siksi kierros poistaa `inert`-attribuutin
valitsimelta ja arviointipalkilta ja pysäyttää niiden osoitintapahtumat ennen
react-ariaa. Itse sivu pysyy sellaisenaan.

`?s=ladataan|mahtuu|ylittyy|arvio|torjuttu|sivusto` ja `?theme=dark`
valitsevat alkutilan. Tiedot ovat keksittyjä: kotihakemiston kiintiö on
20 Gt, josta vapaana 19,8 Gt, ja OneDrive ja kaksi kirjastoa lasketaan
yhteensä 21,4 Gt:ksi, kuten pilotissa.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-microsoft-folder-sizes/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-14-microsoft-folder-sizes/check.mjs \
  design-system/prototypes/dist/microsoft-folder-sizes/offline.html <kuvahakemisto>
```

`web/node_modules` lukitiedoston mukaan (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen. Tarkistus käy kolme
suuntaa ja kuusi tilannetta 1440 ja 390 px:n leveydellä, vaaleana ja
tummana, ja klikkaa polut: ylisuuri valinta → laskenta → hylkäys numeroineen;
A:n Aloita alusta; B:n yläraja-arvio, joka laskettuna mahtuu; B:n Valitse
uudelleen → osa OneDrivesta → valmis; C:n merkit ja hylkäysmittari; englanti.
Konsoli on puhdas.

## What the host would need

Nykytila: discovery listaa OneDriven ja seurattujen sivustojen kirjastot
(`/me/drive`, `/sites/{host,siteId,webId}/drives`). Microsoftin `Folders`
antaa jokaiselle juurelle `UnknownSize`, joten `chooseFolders` ei voi
tarkistaa kiintiötä, eikä `FolderSizer`iä ole. `MeasureFolders` ajaa valinnan
jälkeen `rclone size`n jokaiselle valitulle juurelle. Vasta sen jälkeen
tuore kiintiöhavainto hyväksyy tai hylkää valinnan
(`internal/daemon/integrations/microsoft_files_linux.go`, `relay_linux.go`).
Kaikki alla oleva tapahtuu daemonissa ihmisen omana käyttäjänä ja hänen
omalla tokenillaan. Valta ei siirry komponentilta toiselle.

**Graph-kutsut ja niiden hinta per discovery.**

| Lähde | Kutsu | Hinta | Tarkkuus |
|---|---|---|---|
| Juuren koko (A, C) | `GET /drives/{id}/root?$select=size` | 1 pyyntö per kirjasto, `$batch` 20 kerrallaan: yleensä yksi kierros, alle sekunti | Graphin laskema kansion tiedostojen summa, lähin sitä, minkä rclone kopioi |
| Juuren lapset (B) | `GET /drives/{id}/root/children?$select=id,name,size,folder,file&$top=200` | 1 pyyntö per kirjasto (sivutus `@odata.nextLink` yli 200 kohteen), korvaa juuren koon kutsun | Kansioiden koot ja irtotiedostot, summa on juuren koko |
| Tallennustila (`arvio`) | `drive.quota` (`used`, `deleted`) discoveryn kirjastolistasta tai `GET /drives/{id}?$select=quota` | 0–1 pyyntöä per kirjasto. Listavastaus jättää `quota`n usein pois | Yläraja: `used` sisältää versiohistorian ja roskakorin (`deleted`), ja SharePoint-kirjastolla koko sivuston tallennustilan kaikkine kirjastoineen |

Avautumaton sivusto ei maksa lisää: sen 404/403 saadaan jo nyt.

Tarkistettava oikealla vuokraajalla ennen toteutusta: sisältääkö
SharePoint-kirjaston juuren `size` versiohistorian. Jos sisältää, se on
yläraja kuten `quota.used`, ja isäntä raportoi sen sellaisena.

**Sopimus (`contracts/v1/integration-login.schema.json`).**

- Kansion `estimated: true` saa lajin: `about` (juuren tai kansion
  Graph-koko) tai `at_most` (tallennustila, yläraja). Tuotanto lukee nyt
  kaiken sanalla "noin" (A:n `arvio`-tilanne näyttää, miksi se johtaa
  harhaan).
- B: kansiolla on `parent` (juuren id), ja `ChooseFolders` hyväksyy myös
  lapsen id:n. Juuren osavalinta on rclonessa saman remoten
  `--filter "+ /Kuvat/**"`-säännöt, kuten Googlen kansiovalinta, tai
  polullinen remote (`onedrive:Kuvat`). Tämä ratkaistaan toteutuksessa.
- Epäonnistunut `failed`/`quota_insufficient`-näkymä saa `needed_bytes`- ja
  `free_bytes`-kentät (palvelun tilassa ne ovat jo), ja B ja C myös
  juurikohtaiset lasketut koot.
- Valitse uudelleen (B, C) palaa samassa yrityksessä tilaan
  `choose_folders` kirjautumista uusimatta, ja lasketut koot ovat siinä
  ilman `estimated`-merkintää.
- `unavailable_sites` muuttuu olioiksi `{name, reason}`, jossa `reason` on
  `other_host` (jo lokiin kirjattu `site_host=other_than_reachable_sites`),
  `not_found` (404 samalla isännällä) tai `denied` (403).

**Miten arvio ja laskenta yhdistyvät kiintiön hyväksyntään.** Periaate
pysyy: mitään ei kopioida ilman tuoretta laskentaa ja kiintiöhavaintoa.
Arvio päättää vain kaksi asiaa ennen sitä:

1. Ehdotus. `about`-arvio, joka ei mahdu, ei saa ehdotusta. Tämä on jo
   Googlen sääntö (`suggested > room.Free`).
2. Aloita-painike (B, C). `about`-arvioiden tai laskettujen kokojen summa,
   joka ylittää vapaan tilan, ei käynnistä laskentaa, koska laskenta
   hylkäisi sen lähes varmasti kymmenien minuuttien jälkeen. `at_most`-summa
   ei koskaan estä: Microsoftin yläraja voi ylittää tilan, vaikka kopio
   mahtuisi, joten laskenta ratkaisee. Daemonin `chooseFolders` tekee saman
   tarkistuksen, ettei se jää selaimen varaan. A pitää tuotannon säännön
   (arvio ei estä).

Valinnan jälkeen `MeasureFolders` laskee juuri kerrallaan. Kaksi muutosta:
laskenta lopetetaan heti, kun juoksevan summan ja vielä laskematta olevien
juurten `about`-arvioiden summa ylittää vapaan tilan. Silloin hylkäys tulee
ensimmäisen ison juuren jälkeen eikä vasta lopussa. Lisäksi jokaisen juuren
laskettu koko jää yritykseen, jotta Valitse uudelleen voi näyttää sen.
Kierroksen teksti lupaa, ettei muuttamatonta kirjastoa lasketa uudelleen.
Siksi hyväksyntä käyttää saman yrityksen tuoretta laskentaa (ehdotus: alle
30 minuuttia vanha) ja tekee aina uuden kiintiöhavainnon. Riski: jos
kirjasto on sillä välin kasvanut, passi voi täyttää kotihakemiston
kiintiön, jolloin myös agenttien kirjoitukset epäonnistuvat, kunnes tilaa
vapautuu. Ikäraja pitää riskin pienenä. Vaihtoehto on laskea aina
uudelleen, jolloin teksti muuttuu. Tämä on päätös Jarille (`result.md`).
