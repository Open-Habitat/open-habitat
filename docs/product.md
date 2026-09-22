# Tavoite ja ensimmäinen MVP

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimella oleviin
projekteihin ja AI-agentteihin. Käyttäjä voi jatkaa samoissa hakemistoissa ja
keskusteluissa myös SSH:n, tmuxin ja natiivin agentin kautta. Selaimen sulkeminen
ei saa pysäyttää agenttia.

Ensimmäinen kohde on Alder, Pi ja työpöytäselaimella työskentelevät Jari ja
Kaisa omilla Linux-tunnuksillaan. Yksi palvelin riittää käyttöliittymään.
Arkkitehtuurin lähtökohta on [sovittu Unix-natiivi malli](architecture.md).
Tuotetta ei ole vielä toteutettu. Alla olevat skenaariot ovat toteutuksen ja
testauksen tavoite, eivät näyttö toimivasta järjestelmästä.

## Kaksi näkyvää valmistumispistettä

### Toimiva ydin

Toimiva ydin osoittaa yhden todellisen polun kaikkien kerrosten läpi. Käyttäjä
kirjautuu oikealle Linux-tunnukselle, avaa levyltä löydetyn workspacen ja sen
Pi-historian, käynnistää uuden agentin tai jatkaa olemassa olevaa keskustelua,
lähettää viestin ja seuraa elävää vastausta. Yhteyskatkon jälkeen näkymä palaa
lähteen oikeaan tilaan. Tämä on välitulos, ei koko MVP.

| Tunnus | Onnistuminen | Häiriö, joka pitää näyttää ja käsitellä |
|---|---|---|
| Y1 Kirjautuminen | Jari kirjautuu Alderan, gateway mapittaa web-identiteetin ennalta määrättyyn `jari`-tunnukseen ja vain tämän tunnuksen daemon vastaa. Kaisan vastaava koe päätyy hänen omaan tunnukseensa. | Puuttuva, ristiriitainen tai väärä mappaus torjutaan. Selain ei tarjoa Unix-käyttäjän valintaa eikä näytä toisen käyttäjän workspaceja tai historiaa. Vanhentunut web-istunto säilyttää luettavan sisällön ja luonnoksen, estää kirjoittavat toiminnot ja ohjaa uuteen kirjautumiseen. |
| Y2 Löytäminen ja Git-integrointi | Daemon listaa välittömät hakemistot käyttäjän `~/src`-hakemistosta myös silloin, kun workspace-asetustiedostoa tai Git-repoa ei ole. Tavallinen hakemisto voidaan avata suoraan. Git-repo avataan vasta, kun estävä integrointivaihe on varmistanut repokohtaisen ympäristön, jossa myös agentin tavalliset `git pull`- ja `git push` -komennot ovat käyttövalmiita. | Puuttuva `~/src`, lukuvirhe, vanhentunut tieto ja osittain löytynyt metadata erotetaan tyhjästä listasta. Integrointidialogi pysyy estävänä ja kertoo erikseen, mikä repository-, remote-, oikeus-, credential- tai verkkotarkistus onnistui, epäonnistui tai jäi tuntemattomaksi. Puuttuva Git-, tmux- tai Taskfleet-tieto on “ei tiedossa”, ei keksitty arvo. |
| Y3 Keskustelun avaaminen | Historia luetaan Pi:n tiedostosta natiivilla resume-ID:llä. Elävä prosessi, päättynyt mutta jatkettava keskustelu ja vain havaittu prosessi näkyvät eri tiloina; pelkkä avaaminen ei resumoi. Käynnissä olevaan terminaali-TUI:hin ei liitetä RPC:tä. | Puuttuva tai vioittunut historia ei luo korvaavaa historiaa. Jos selaimesta ohjaamista ei ole todennettu, historia on luettavissa mutta lähetys, keskeytys ja lopetus on estetty syineen. |
| Y4 Käynnistys, resume ja viesti | Käyttäjä käynnistää rajatussa testiworkspacessa Pi-agentin tai valitsee erillisen “Resumoi”-toiminnon, lähettää yhden viestin, saa hyväksymiskuittauksen ja näkee vastauksen tapahtumat järjestyksessä lopputilaan asti. Hallittu siirto terminaalista selaimeen pysäyttää ensin TUI-prosessin turvallisesti, varmistaa natiivihistorian asettuneen ja käynnistää vasta sitten uuden runtimen komennolla `pi --mode rpc --session <session>`. | Käynnistyksen, pysäytyksen, historian asettumisen tai resumen virhe jättää natiivihistorian ehjäksi eikä käynnistä kilpailevaa runtimea. Lähetysvirhe kertoo, hylättiinkö viesti vai jäikö tulos epävarmaksi; epävarmaa viestiä ei lähetetä automaattisesti uudelleen. |
| Y5 Katkos ja itsenäinen työ | Selaimen sulkeminen tai SSE-yhteyden katkeaminen ei lopeta agenttia. Palatessa cursor jatkaa puuttuvista tapahtumista tai selain hakee uuden snapshotin, ja näkymä vastaa natiivia lähdettä ilman kaksoisviestejä. | Katkoksen aikana tila merkitään viimeksi saaduksi ja kirjoittavat toiminnot estetään. Vanhentunut cursor johtaa uuteen snapshotiin, ei arvattuun tapahtumaketjuun. |

Toimivan ytimen demo hyväksyy Y1–Y5:n yhden oikean Pi-keskustelun
käynnistys–päättyminen–resume-elinkaarella, kahden Linux-käyttäjän
reititystestillä ja, jos Pi-koe osoittaa sen löydettäväksi, yhdellä terminaalissa
aloitetulla vain luku -prosessilla. Todentamattoman liittymisen tilaa ei hyväksytä
pelkällä mockilla; jos prosessia ei voi löytää luotettavasti, raja kirjataan
demoon näkyvästi. Demo ei vielä hyväksy alla olevia workspace-, GitHub-,
worktree-, arkisto- tai operointitoimintoja.

### Koko MVP

Koko MVP säilyttää toimivan ytimen ja lisää jo hyväksytyt host-toiminnot sekä
katselmoidun keskustelukokemuksen:

| Tunnus | Onnistuminen | Häiriö, joka pitää näyttää ja käsitellä |
|---|---|---|
| M1 Keskustelu | Markdown, koodi, pitkät tulokset, ryhmitellyt työkalut, kopiointi ja adapterin tukemat käyttäjäpyynnöt ovat käytettäviä. Pi:n tuetun `edit`-työkalun rakenteinen diff näytetään diffina. Muut työkalut saavat käyttää tarjoamaansa yleistä tulosesitystä; esimerkiksi bashilla tehty tiedostomuutos ei lupaa synteettistä diffiä. Keskeytys pysäyttää vuoron, ei koko prosessia. Luonnos, fokus ja lukukohta säilyvät päivityksissä. | Tuntematon tapahtuma ja työkalutulos säilytetään turvallisessa yleisesityksessä. Työkalun, käyttäjäpyynnön tai keskeytyksen virheellä on oma tila. Jonotus ja kesken vuoron ohjaus toteutetaan vain Pi-kokeen ja UI-katselmoinnin hyväksymässä muodossa. |
| M2 Workspacen luonti ja asetukset | Käyttäjä luo `~/src`:n alle tyhjän tai paikallisen Git-workspacen. Olemassa olevassa ei-Git-workspacessa Gitin voi ottaa käyttöön asetuksista. Hyväksytty automaatio voi avata tavallisen workspacen, käynnistää ensimmäisen agentin ja siirtää fokuksen viestikenttään; Gitiksi muuttunut tai luotu repo kulkee ensin M4:n estävän integroinnin läpi. Näyttönimi ja tarvittava pysyvä ID tallentuvat workspacen omaan `.agent-host/workspace.json`-tiedostoon. | Virhe hakemiston, `git init`in, integraation, asetuksen tai agentin luonnissa näyttää toteutuneet ja toteutumattomat vaiheet. Hakemiston tai `git init`in onnistumista ei väitetä perutuksi, jos integraatio tai myöhempi agentin käynnistys epäonnistuu. |
| M3 Näkyvyys ja poisto | Workspacen voi piilottaa listasta ilman levymuutosta ja palauttaa näkyviin. Poisto vaatii täsmällisen vahvistuksen, lopettaa sovitusti hallittavat agentit ja poistaa oikean hakemiston. | Katkos estää toiminnot. Vain havaittu tai muu pysäyttämätön prosessi estää poiston ja kertoo syyn. Workspaceen liittyvät `~/src`:n ulkopuoliset worktreet näytetään vaikutuksina eikä niitä poisteta hiljaa. Epäonnistunut tai osittainen poisto kertoo, mitä levylle, worktreehin ja prosesseille jäi; käyttöliittymä ei merkitse workspacea poistetuksi ennen lähteen vahvistusta. |
| M4 GitHub | Ennen Git-repon ensimmäistä avaamista estävä integrointidialogi tarkistaa ja tarvittaessa valmistelee sekä repon että Unix-käyttäjän credential-ympäristön agenttien tavallisia `git pull`- ja `git push` -komentoja varten. Pelkkä `gh`-kirjautumisen havaitseminen ei riitä. Samassa rajassa käyttäjä voi myöhemmin luoda paikalliselle repolle etärepon tai hakea/valita repon ja kloonata siitä workspacen. Näkyvyys ja lopullinen `origin` luetaan Gitistä/GitHubista. Integroinnin tekninen toteutustapa on vielä avoin. | Dialogi ei päästä repo-workspaceen ennen onnistumista. Se näyttää repositoryn, remoten, oikeuksien, credentialien ja verkon onnistuneet, epäonnistuneet ja tuntemattomat vaiheet peittämättä paikallisesti onnistunutta mutta etänä epäonnistunutta operaatiota. Korjaus ja uudelleenyritys ovat mahdollisia samasta rajasta; credential-toteutusta tai tuotantopinoa ei päätetä tässä. |
| M5 Taskfleet-worktree | Käyttäjä käynnistää Git-workspacesta uuden omistetun agenttiympäristön valitsemalla lähtökohdan ja vapaan branch-nimen. Taskfleet yksin luo ja hallitsee worktreen, käynnistää Pi:n sen oikeassa execution rootissa ja avaa agentin. UI ei luo, muokkaa eikä hallitse mielivaltaisia manuaalisia Git-worktreeitä. | Ei-Git-workspacessa toiminto on perustellusti estetty. Branch-/polkukonflikti tai Taskfleet-ajon osittainen tulos raportoidaan sen natiivin tilan mukaan; Gitin tilaa ei arvata. Muualta löydetty worktree voidaan näyttää vaikutuksena tai tuntemattomana faktana, mutta siitä ei tehdä tuettua hallintakohdetta. |
| M6 Lopetus, arkisto ja jatkaminen | “Lopeta ja arkistoi” lopettaa hallittavan prosessin ja piilottaa keskustelun aktiivisesta listasta. Arkisto listaa natiivista historiasta ja välttämättömistä annotaatioista johdetut keskustelut. “Jatka” käyttää samaa resume-ID:tä, palauttaa keskustelun listaan ja fokusoi viestikentän. | Arkistointi ei poista tai kopioi Pi-historiaa omaan tietokantaan. Jo päättynyt, vain havaittu tai jatkamiskelvoton keskustelu saa rehellisen tilan. Osittainen stop/archive/resume kertoo säilyneen natiivin tilan. |
| M7 Operointi ja erottelu | Dokumentoitu asennus, päivitys ja palautuminen onnistuvat yhdellä palvelimella. Gateway, molemmat käyttäjädaemonit ja agentit palautuvat sovitusti; käyttäjien tiedot pysyvät erillään ja natiivi käyttö SSH:lla/tmuxilla toimii edelleen. | Väärän käyttäjän reititys torjutaan kaikissa pyynnöissä. Daemonin tai gatewayn restart, epäonnistunut päivitys ja rollback eivät kadota Pi-historiaa, Git-tilaa tai workspace-asetuksia. |

## Pilotin ehdotettu hyväksyntä

Tämä on mitattava ehdotus [MVP-katselmointiin](../issues/review-mvp/item.md), ei
Jarin hyväksyntä. Pilotissa käytetään alustavasti seuraavaa edustavaa kuormaa:

- kaksi testattua web-identiteettiä ja kaksi Linux-käyttäjää;
- kummallakin vähintään yksi oikea Pi-historia; yhteensä vähintään kolme
  workspacea: hakemisto ilman Gitiä, paikallinen Git-repo ja luvallinen
  disposable GitHub-repo;
- yksi terminaalissa aloitettu keskustelu, yksi selaimesta käynnistetty keskustelu,
  kaksi samanaikaisesti aktiivista agenttia ja yksi Taskfleetin hallitsema agentti-worktree;
- vähintään yksi pitkä historia, pitkä työkaluoutput, koodilohko, diffi, tuettu
  käyttäjäpyyntö sekä tuntematon tapahtumatyyppi;
- arkistointi ja saman natiivin keskustelun jatkaminen sekä selain-, SSE-, daemon-
  ja gateway-katkos sovituissa turvallisissa testiympäristöissä.

Ehdotetut läpäisyehdot ovat: Y1–Y5 ja M1–M7 suoritetaan ennalta kirjatuilla
odotuksilla; kummankaan käyttäjän sisältöä ei vuoda toiselle; hyväksytty viesti
ei katoa tai monistu; epävarmaa viestiä ei lähetetä automaattisesti uudelleen;
selainkatkos ei lopeta agenttia; natiivihistoria, Git-tila ja workspace-asetukset
säilyvät restartissa ja rollbackissa; jokainen tahallinen häiriö näyttää käyttäjälle
oikean esto-, virhe- tai osittaisen tuloksen. Nollahavainto vaaditaan luvattomasta
ristikäyttäjäpääsystä, tietohäviöstä ja hiljaisesta kaksoislähetyksestä.
Kaikki muut havaitut puutteet kirjataan ennen Jarin käytännön katselmointia.

## Sovittu suunta ja vielä päätettävä toiminta

Workspace- ja agenttinavigointi, workspacejen luonti ja poisto, piilotus,
asetukset, estävä Git-integrointi ja GitHub-kytkentä, Taskfleetin hallitsemat
agentti-worktreet, arkisto sekä sovitut automaattiset luontitoiminnot kuuluvat
koko MVP:hen. Niitä ei saa hiljaisesti pudottaa
teknisen hankaluuden vuoksi. Tarvittava poikkeama tuodaan Jarin päätettäväksi.

Pi-koe vahvisti jonon ja steeringin rajatun kyvyn sekä sen, ettei käynnissä
olevaan terminaali-TUI:hin ole RPC-attachia. Jonon tarkka UI, synopsis,
stop–history–RPC-siirron esitys, luonnoksen pysyvyys ja huomiotapa toisen agentin
odottaessa ratkaistaan [UI-katselmoinnissa](../issues/review-ui-v1/item.md).
Historiasta löytyminen, prosessin käynnissäolo ja ohjattavuus ovat eri asioita.

## Ensimmäisen version ulkopuolella

Mobiili, usean palvelimen navigointi, muut harnessit, prosessikeskus ja laajemmat
editori-/työkalunäkymät odottavat erillistä valintaa. Northwindin ja Acmen
sovelluskohtaiset käyttöönotot säilyvät myöhempinä tavoitteina.

Katso [vaiheistus](implementation.md), [avoimet oletukset](assumptions.md) ja
[käyttöliittymän käyttökulut](ui.md).
