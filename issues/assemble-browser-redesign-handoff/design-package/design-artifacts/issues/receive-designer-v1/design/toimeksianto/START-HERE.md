# Suunnittelutoimeksianto 2: keskustelukäyttöliittymä v1

Päivitetty 2026-09-20. Tämä korvaa saman paketin aiemman laajemman rajauksen.

Tämä on itsenäinen toimeksianto käyttöliittymäsuunnitteluagentille. Kaikki
suunnittelun aloittamiseen tarvittava tausta on tässä tekstissä. Älä oleta pääsyä
repoon tai aikaisempaan keskusteluun. Suunnittele käyttöliittymävedokset tämän
pohjalta; tuotantobackendia ei tarvitse toteuttaa. Jos teet toimivan frontend-proton,
käytä kuvitteellisia tietoja ja simuloituja tapahtumia.

Tavoitteena on selkeä, rauhallinen ja käytännöllinen työkalu päivittäiseen työhön.
Valitse alustava visuaalinen suunta itse ja tee se näkyväksi. Käytä vedoksissa
suomenkielisiä käyttöliittymätekstejä; tämä on suunnittelun oletus, ei päätös tuotteen
lopullisista kielistä. Näytä oikean näköistä sisältöä placeholder-tekstin sijaan.

## Millainen tuote tämä on

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimilla oleviin
workspaceihin ja natiiveihin AI-agentteihin. Käyttäjä voi edelleen kirjautua
SSH:lla, käyttää tmuxia ja jatkaa agenttikeskusteluja komentoriviltä.

Tuote nojaa avoimen lähdekoodin Unix/Linux-ohjelmistoihin ja niiden pitkään
kehitettyihin, vakaisiin ratkaisuihin. Käytämme olemassa olevia komponentteja
niiden omilla rajapinnoilla ja asetuksilla. Esimerkiksi Pi:n oletusmalli
määritellään Pi:n omassa konfiguraatiossa. Agent Host yhdistää komponentit
käyttökelpoiseksi selainkäyttöliittymäksi.

Pidämme ratkaisun yksinkertaisena. Lisäämme tallennettavaa tietoa tai uuden
ominaisuuden, kun sille löytyy konkreettinen käyttötarve.

## Arkkitehtuuri käyttöliittymän kannalta

```text
Selain
  └─ Palvelimen autentikoiva gateway
       └─ käyttäjän Linux-tunnuksella ajettava daemon
            ├─ ~/src-hakemistot
            ├─ agenttien natiivihistoriat ja elävät prosessit
            └─ Git, tmux, Taskfleet ja agenttien extensionit
```

- Selain voi yhdistää useaan palvelimeen. Yhden palvelimen yhteysongelma ei
  tarkoita, että muiden palvelinten agentit olisivat pysähtyneet.
- Yksi web-identiteetti vastaa yhdellä palvelimella yhtä ylläpitäjän määrittämää
  Linux-käyttäjää. Käyttäjä ei vaihda Unix-tunnusta käyttöliittymän valitsimesta.
- Jokaisella tenantilla on oma deployment. Hostin sisälle ei suunnitella
  tenant-hallintaa, organisaatiovalitsinta tai jäsenrekisteriä.
- Workspace on aina välitön hakemisto käyttäjän `~/src`-hakemiston alla. Se voi
  olla Git-repo tai olla olematta. Workspace-rekisteriä ei ole.
- Workspace-kohtaiset asetukset ovat sen omassa `.agent-host/workspace.json`-
  tiedostossa. Hakemisto näkyy myös ilman asetustiedostoa.
- Agentin tunniste on harnessin natiivi resume-ID nimellä täydennettynä,
  esimerkiksi `pi:abc123`. Käyttöliittymässä voi näyttää luettavan otsikon;
  tekninen ID kuuluu tarvittaessa lisätietoihin.
- Keskustelu ja mallin vaihtumiset luetaan harnessin historiasta. Agent Host
  ei ylläpidä toista keskusteluhistoriaa tai rinnakkaista harness-konfiguraatiota.
- Agentilla on Linux-käyttäjän oikeudet ja credentialit. Extensionin hyväksyntä
  tai rajoitus ei itsessään tee agentista sandboxattua.
- Selain hakee nykytilan HTTP:llä, lähettää komennot HTTP:llä ja seuraa yhtä
  yhdistettyä SSE-tapahtumavirtaa per palvelin. Cursorit eivät kuulu perusnäkymään.
- Selaimen sulkeminen ei pysäytä agenttia. Historia voi olla luettavissa myös
  silloin, kun agentin prosessi ei ole käynnissä.

## Mikä on päätetty ja mikä suunnitellaan

Yllä oleva tausta on sovittu lähtökohta. Tämän toimeksiannon näkymäjako,
kontrollit ja asettelut ovat ehdotuksia vedoksia varten.

Ensimmäisessä toimivassa protossa käytämme yhtä palvelinta ja Pi:tä.
Tässä paketissa suunnitellaan yksi valittu keskustelu yhdellä palvelimella.
Usean palvelimen navigointi kuuluu pakettiin 1.

Historiasta löytyminen, prosessin käynnissäolo ja selaimesta ohjattavuus ovat eri
asioita. Vielä ei ole todennettu, miten jo terminaalissa käynnissä olevaan
agenttiin liitytään. Vedos ei saa luvata ohjausta pelkän löydettävyyden perusteella.

## Suunnitelmien yhteinen liittymä

Osa 1 valitsee palvelimen, workspacen ja agentin. Osa 2 avaa kyseisen agentin
keskustelun samassa sovelluksessa. Agentin avaaminen ei itsessään resumoi sitä.
Uuden agentin käynnistys päättyy sen keskustelunäkymään, kun natiivi identiteetti
on saatu. Käynnistyksen aikana näytetään keskeneräinen tila.

Molemmissa näkyvät sama valittu palvelin, workspace ja agentti. Takaisin
workspaceen siirtyminen säilyttää käyttäjän paikan. Tarkka reittimuoto, paneelit
ja mobiilinavigointi päätetään vedoksissa.

Sopikaa molemmille yhteinen merkityssisältö:

| Asia | Mitä käyttäjän pitää ymmärtää |
|---|---|
| Palvelinyhteys | Yhdistetty, yhdistetään tai yhteys poikki |
| Agentin havaittu tila | Työskentelee, odottaa käyttäjää, valmis/odottaa viestiä, ei käynnissä tai ei tiedossa |
| Ohjattavuus | Mitkä toiminnot ovat juuri nyt käytettävissä ja miksi jokin ei ole |
| Tiedon tuoreus | Näytetäänkö nykytilaa vai viimeksi saatua tietoa |

Nämä ovat UI-merkityksiä, eivät uusi pysyvä tilarekisteri. Käytä vain tiloja,
joille adapteri antaa tiedon; tuntematonta ei päätellä valmiiksi tai pysähtyneeksi.

## Yhteinen esimerkkiaineisto

Käytä samoja kuvitteellisia tietoja molempien osien vedoksissa:

- Palvelin `Alder`, käyttäjä `jari`.
- Workspace `native-agent-host`, polku `/home/maintainer/src/native-agent-host`, Git-repo.
- Workspace `muistiinpanot`, polku `/home/maintainer/src/muistiinpanot`, ei Git-repo.
- Pi-agentti `Workspace-listauksen toteutus`, työskentelee ja on ohjattavissa.
- Pi-keskustelu `SSE-yhteyden suunnittelu`, ei käynnissä, historia luettavissa.
- Agentti `Terminaalissa aloitettu työ`, prosessi havaittu, ohjaus ei saatavilla.
- Toinen palvelin `Kehityskone`, yhteys poikki.

Tiedot ovat vedosaineistoa, eivät väitteitä palvelimen nykytilasta.

## Tehtävä: pieni, toimiva keskustelukäyttöliittymä

Suunnittele v1, jossa käyttäjä lukee historiaa, jatkaa keskustelua, lähettää viestin,
seuraa agentin työtä ja voi keskeyttää sen. Tee ensin tästä käyttökelpoinen.
Käytä simuloituja tapahtumia klikattavassa protossa; oikean Pi-yhteyden toteutus
on eri työ. Älä lisää myöhempien ominaisuuksien painikkeita tai tyhjiä paneeleja.

V1 tarkoittaa tässä käyttöliittymän ensimmäistä toteutettavaa versiota. Se ei ole
koko arkkitehtuurin versiojulistus. Suunnittelussa käytettävät toimintarajat on
määritelty alla; oikean adapterin tuki on vielä todennettava.

### Mitä Fleetrepon TUI-kokemuksesta otetaan mukaan

Käyttäjän toimittama 2026-09-20 raportti kuvaa Pi:n extensioneilla parannettua
terminaalikäyttöliittymää. Otamme siitä v1:een kompaktin ryhmitellyn työkalunäkymän,
selkeät elävät tilat, työkalukohtaiset yhteenvedot, avattavan outputin, yksinkertaisen
diff-esikatselun ja sujuvan tekstinsyötön sekä kopioinnin.

Raportti on käyttökokemusreferenssi, ei todennettu selain-API. Terminaalin
hiirikohdistusta tai rivinvaihtojen korjausta ei tarvitse toteuttaa uutena
selainominaisuutena: tavallinen editori ja semanttinen HTML hoitavat perustan.

### V1:n asettelu

Keskustelu ja työkalujen toiminta muodostavat yhden luettavan keskialueen.
Alhaalla on monirivinen viestikenttä. Ylhäällä näkyvät agentti, workspace,
palvelinyhteys ja havaittu tila. Malli ja thinking level voidaan näyttää hillitysti,
jos lähde antaa ne. Käyttäjän vastausta vaativa pyyntö erottuu keskustelussa.

Työpöydällä ja mobiilissa säilyy sama pääpolku. Pitkä output ja diff avautuvat
keskustelun yhteydessä. V1:ssä ei ole Process Centeriä, prosessitelakkaa,
lokimodaalia, prosessien alapalkkia, recap-korttia tai profiilivalitsinta.

### V1:n näkymät ja tilat

Tunnukset säilyvät aiemmasta paketista. B11 (prosessipaneeli) siirtyy myöhemmäksi.

| Tunnus | Näkymä | Mitä suunnitellaan nyt |
|---|---|---|
| B1 | Keskustelun runko | Konteksti, paluu workspaceen, tyhjä keskustelu, historian lataus ja lukuvirhe. |
| B2 | Historia | Viestit, Markdown, koodi ja työkalutapahtumat; pitkä sisältö ja tuntematon tapahtumatyyppi. Kopioi viesti ja Kopioi koodi -toiminnot. |
| B3 | Syöte | Tavallinen monirivinen editori, luonnos, lähetys kesken, vastaanotettu ja epäonnistunut lähetys. Luonnos säilyy sovelluksen sisäisessä navigoinnissa. |
| B4 | Käynnissä oleva työ | Streamaava vastaus ja työkalut, selkeä työskentelee/valmis/virhe/keskeytetty-ero. Käyttäjä saa lukea aiempaa tekstiä ilman pakotettua skrollia. |
| B5 | Työkalujen toiminta | Tiiviit omat esitystavat, ryhmät ja avattavat yksityiskohdat; tarkennukset alla. |
| B6 | Yksinkertainen käyttäjäpyyntö | Harnessin välittämä tekstikysymys tai valinta, tarvittaessa hyväksy/hylkää. Vastaus kesken, virhe ja jo muualla käsitelty pyyntö. Jos vastaamista ei tueta, näytä syy. Ei uusia hyväksyntäsääntöjä. |
| B7 | Resume | Historia näkyy ilman elävää prosessia. Jatka käynnistää resumen; odotus, onnistuminen, virhe ja puuttuva historia. |
| B8 | Vain luettavissa | Agentti on löydetty mutta sitä ei voi ohjata. Selitys ja saatavilla oleva historia. Älä käynnistä samaa keskustelua uudelleen havaitun elävän prosessin rinnalle. |
| B9 | Keskeytys | Keskeytä nykyinen työ, odota vahvistusta, näytä onnistuminen tai virhe. Tämä ei tarkoita agenttiprosessin tai kaikkien taustaprosessien lopettamista. |
| B10 | Yhteys katkeaa | Viimeisin sisältö säilyy, tiedon vanheneminen näkyy, yhteyden palatessa tila päivittyy. Epäselvästi onnistunutta lähetystä ei toisteta automaattisesti. |
| B12 | Natiivista lähteestä tuleva päivitys | Kun lähde kertoo muualla syntyneen viestin, mallinvaihdon tai vastatun pyynnön, näkymä päivittyy luonnosta ja lukukohtaa rikkomatta. Tämä ei lupaa yhteisohjausta jokaiselle terminaaliprosessille. |

B6 on ehdollinen toiminto myös v1:ssä: piirretty vastauspainike ei todista
extensionin selainrajapintaa. Näytä tuettu ja ei-tuettu tilanne. Tavallisen
keskustelun käyttö ei saa riippua extensionien olemassaolosta.

### Työkalujen esittäminen v1:ssä

Jokaisen työkalukutsun ei tarvitse olla suuri kortti. Valitse esitystapa sisällön
mukaan. Kehittäjä voi ohjelmoida renderöinnin ja ryhmittelyn; v1 ei tarvitse
käyttäjän sääntöeditoria tai plugin-hallintaa.

| Tapahtuma | V1:n esitys |
|---|---|
| Tiedoston luku | Tiivis rivi: polku, toiminto ja tila; yksityiskohdat avattavissa. |
| Haku | Hakutermi ja lyhyt tulosesikatselu, jos saatavilla. |
| Shell-komento | Komento, tila, viimeisin lyhyt output ja avattava saatu output; exit-koodi vain lähteestä. Tämä ei ole taustaprosessien hallintanäkymä. |
| Muokkaus tai uusi tiedosto | Polku ja yksinkertainen unified-diff, jos oikea diff on saatavilla. Pitkä diff supistetaan ja voidaan avata. Ilman diff-tietoa näytetään saatavilla oleva tulos, ei keksittyä muutosta. |
| MCP- tai muu tuntematon työkalu | Tiivis nimi, tila ja avattavat argumentit/tulos. Erillistä renderer-kirjastoa kaikille MCP-työkaluille ei tarvita. |
| Käyttäjäpyyntö | Oma näkyvä vastauskomponentti, ei ryhmän sisään piilotettuna. |

Näytä tila tekstillä tai symbolilla värin lisäksi. Käynnissä olevan työkalun
lyhyt tulosesikatselu päivittyy vain, jos lähde toimittaa välituloksia.
Diff on tarkastelua varten: älä lisää Hyväksy muutos -toimintoa, ellei harness
ole oikeasti pysäyttänyt toimintaa hyväksyntää odottamaan.

Ryhmittele saman agentin saman vuoron vierekkäisiä työkalutapahtumia. Esimerkiksi
15 tiedostolukua mahtuu yhteen avattavaan yhteenvetoon. Näytä rinnakkaisuus, jos
lähde sen kertoo; älä piirrä keksittyä suoritusjärjestystä tai riippuvuuspuuta.
Uusi viesti tai käyttäjäpyyntö katkaisee ryhmän. Yksittäiset kutsut ja niiden
järjestys säilyvät tarkasteltavina.

Ryhmän otsikossa näkyvät myös virhe ja keskeneräisyys. Ryhmän avaaminen,
lukukohta ja fokus säilyvät streamauksen aikana. Historiasta luettu sama sarja
näyttää johdonmukaiselta elävän sarjan kanssa. Todella suuri output voidaan
näyttää lyhennettynä, mutta kerro rajauksesta: ”koko output” tarkoittaa vain
lähteen oikeasti säilyttämää sisältöä.

B5:n tilavedokset:

- **B5a:** yksi tiedostoluku ja 15 luvun ryhmä suljettuna ja avattuna.
- **B5b:** ryhmä, jossa yksi kutsu työskentelee, toinen epäonnistui ja kolmas keskeytettiin.
- **B5c:** haku, shell-komento ja unified-diff; myös muutos ilman diff-tietoa.
- **B5d:** tuntematon työkalu, osittaiset argumentit ja pitkä lyhennetty tulos.
- **B5e:** yksinkertainen käyttäjäpyyntö ryhmien välissä.
- **B5f:** sama tapahtumasarja streamatessa ja historiaa lukiessa; rinnakkaisuus
  ja lukukohdan säilyminen mukana.

### Editorin ja kopioinnin peruskäytös

Käytä selaimen normaalia tekstivalintaa, hiirikohdistusta ja editorin undo-toimintoa.
Monirivinen teksti, liittäminen ja IME-syöttö toimivat. V1-ehdotus: Enter lähettää,
Shift+Enter lisää rivinvaihdon, mutta IME-koostamisen Enter ei lähetä viestiä.
Näytä myös selkeä Lähetä-painike, jota mobiilikäyttäjä voi käyttää.

Työn aikana saa kirjoittaa luonnosta; uutta viestiä ei lähetetä ennen työn
päättymistä tai vahvistettua keskeytystä. Käyttäjäpyyntöön vastataan erillisellä
kontrollilla. V1 ei lupaa viestijonoa tai kesken työn tapahtuvaa steeringiä.

Kopioi viesti -painike kopioi sen lähdetekstin ja Kopioi koodi vain koodin.
Säilytä rakenteelliset rivinvaihdot; visuaalinen rivitys, tilamerkit ja koristeet
eivät kuulu mukaan. Vapaaseen osittaiseen tekstivalintaan jätetään selaimen
normaali kopiointi. Näytä lyhyt onnistumis- tai epäonnistumisilmoitus.
Ei yleistä copy-tapahtuman kaappausta eikä kahden kopiointitilan asetusta v1:een.

### Yksi tarina vedosten läpi

Käyttäjä avaa ”Workspace-listauksen toteutus” -keskustelun ja pyytää:
”Näytä ~/src-hakemistot workspace-listassa.” Agentti kertoo tutkivansa nykyisen
reitin, lukee useita tiedostoja, tekee haun ja muuttaa kuvitteellista tiedostoa
`src/workspaces.ts`. Näytä muutos unified-diffinä. Shell-kokeilu epäonnistuu;
virhe näkyy myös suljetussa ryhmässä. Käyttäjä lähettää tarkennuksen työn päätyttyä.

Tee vaihtoehtoisina tiloina käyttäjäpyyntö, työn keskeytys ja katkos juuri
lähetyshetkellä. Tarkista myös historian avaaminen uudestaan ja viestin/koodin
kopiointi. Esimerkkitiedostot ja tapahtumat ovat kuvitteellisia. Älä keksi mallin
sisäistä päättelyä; käytä vain käyttäjälle tarkoitettuja viestejä ja saatavia tapahtumia.

## Myöhemmin, ei tämän kierroksen vedoksiin

TUI-raportin prosessipaneeli, lokihaku, prosessitelakka, ilmoitusvahdit,
slash-täydennys, recap, tehtäväprofiilit ja monipuolisemmat diffit ovat myöhempää
työtä. Ne on kirjattu erilliseen LATER.md-liitteeseen zipissä. Tämä toimeksianto
on itsenäinen: liitettä ei tarvita v1:n suunnitteluun eikä sen sisältö ole
palautettavien vedosten lista.

Pidä keskustelun asettelu selkeänä. Myöhemmin siihen voidaan lisätä tarvittava
paneeli, mutta älä varaa nyt pysyvää sivupalkkia tai tyhjiä kontrolleja sitä varten.
Selaimen prosessinäkymä lukee ja ohjaa agentin/extensionin hallitsemia prosesseja
daemonin kautta. Raportin ehdotus uudesta omistavasta palvelimesta tai WebSocketista
ei muuta sovittua omistajuutta ja HTTP/SSE-rajapintaa.

## Komponenttien käyttö ja muokattavuus

Hyödynnä valmiita avoimen lähdekoodin UI-komponentteja, kun ne sopivat näkymään.
Niiden esitystapaa pitää voida muokata ohjelmallisesti. Kirjaston demo ei määritä
tuotteen ominaisuuksia tai pakota jokaista työkalukutsua samanlaiseen korttiin.

Beautiful UI on kiinnostava visuaalinen lähtökohta. assistant-ui on mahdollinen
keskustelun renderöinnin apukirjasto. Kumpaakaan tai niiden yhdistelmää ei ole vielä
valittu tuotannon teknologiaksi. Vedoksia varten voit käyttää niitä tai soveltaa
niiden komponentteja; kerro mitä käytit ja mitä muokkasit. Varsinainen harness
suorittaa työkalut, käyttöliittymä esittää niiden tapahtumat.

Kopioitavan tai muokattavan lähdekoodin lisenssin pitää sallia suunniteltu käyttö.
Tarkista valitun lähteen, version ja mukana tulevien riippuvuuksien lisenssit ja
säilytä tarvittavat ilmoitukset. Älä oleta koko esimerkkisivuston kaikkien osien
olevan samalla lisenssillä. Tässä paketissa ei vahvisteta Beautiful UI:n kaikkien
jakeluiden tai ikoniriippuvuuksien lisenssejä.

Viitteitä (tarkistettu 2026-09-19; käyttöliittymän tehtävä on kuvattu kokonaan tässä
paketissa, linkit ovat lisämateriaalia):

- [Beautiful UI](https://www.beautifului.dev/): muun muassa Tool Chips,
  Context Cards, Task Rows, Approval Card ja Code Block. Sivun Diff Table on
  taulukkomuutosten esityskomponentti; älä oleta sen olevan valmis Git-diff-näkymä.
- [Beautiful UI:n rekisteri](https://www.beautifului.dev/r/registry.json):
  komponenttilähteiden asennusrekisteri. Sidebar Navin rekisteritietue sisältää
  `@central-icons-react`-riippuvuuden; ikonivalinta tarkistetaan erikseen.
- [assistant-ui:n työkalurenderöinti](https://www.assistant-ui.com/docs/tools/defining-tools):
  omat esityskomponentit myös muualla suoritettaville työkaluille.
- [assistant-ui:n ryhmittely](https://www.assistant-ui.com/docs/guides/part-grouping):
  `GroupedParts` ryhmittelee viestin peräkkäisiä osia; se ei sellaisenaan ole
  kaikkien agenttien yhteisen tapahtumavirran ryhmittelijä.
- [assistant-ui:n ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store):
  mahdollinen sovitus oman sovellustilan ja keskustelukomponenttien välille.

Kirjaston käyttö ei vaihda sovittua HTTP/SSE-rajapintaa tai natiivihistorian
omistajuutta. UI:ta varten saa muodostaa muistissa esitysmuodon ja ryhmiä, mutta
siitä ei tehdä uutta pysyvää agenttihistoriaa. Adapterin ja valitun kirjaston
sopivuus kokeillaan ennen niiden varaan lukitsemista; älä arvioi sovituksen
vaativuutta oletetulla muutaman sadan rivin lupauksella.

## Mitä palautat ja missä järjestyksessä

1. **Ensimmäinen arvioitava vedos:** keskustelun pääasettelu, editori, tiivis
   työkaluryhmä avattuna/suljettuna ja yksinkertainen diff. Työpöytä ja mobiili.
   Esittele tämä suunta ennen kaikkien poikkeustilojen viimeistelyä.
2. **Suunnan tarkastelun jälkeen:** v1:n klikattava pääpolku ja B1–B10, B12 sekä
   B5a–B5f-tilat. Jos klikkiprototyyppi ei onnistu, palauta numeroitu ruutusarja
   yksiselitteisine siirtymineen. B11 ei kuulu tähän toimitukseen.
3. Lyhyt taulukko tunnuksista vedoksiin, tärkeimmät UI-valinnat ja tiedot siitä,
   mitä valmiita komponentteja käytit. Kerro mitkä toiminnot on simuloitu.
4. Sama luettava typografia, välit, värit ja kontrollit paketin 1 suunnittelijalle.
   Älä tee rinnakkaista palvelin- tai workspace-navigointia tähän pakettiin.

V1:n vedokset ovat valmiit tarkasteltaviksi, kun käyttäjä voi lukea historian,
jatkaa, lähettää, seurata työkaluja, avata diffin/outputin, vastata tuettuun
kysymykseen, keskeyttää, kopioida ja selvitä yhteyskatkosta. Näppäimistöfokus,
luonnos ja lukukohta säilyvät päivityksissä. Liike on hillittyä ja vähennettävissä;
tiloja ei ilmaista vain värillä. Myöhempien ominaisuuksien toteutusta ei tarvita.

Klikattavan vedoksen toimivuus ei vielä osoita Pi-integraation toimivuutta.
Toteutuksessa kokeillaan sama polku oikealla Pi:llä ja sen jälkeen valitaan
seuraava lisättävä ominaisuus käytön perusteella.
