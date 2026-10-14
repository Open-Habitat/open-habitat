# Open Habitat — tavoite ja käyttökulut

Open Habitat tuo selaimen käyttöliittymäksi Linux-palvelimella oleviin
projekteihin ja AI-agentteihin. Käyttäjä avaa oman työtilansa, keskustelee
agentin kanssa ja seuraa sen työtä. Tiedostot, Git-repot ja keskusteluhistoria
pysyvät natiivien työkalujen omassa muodossa ja käytettävissä myös SSH:n ja
tmuxin kautta. Selaimen sulkeminen jättää agentin työskentelemään.

Tuote käyttää Pi:tä yhdellä Linux-palvelimella. Jokainen ihminen työskentelee
omalla Linux-tunnuksellaan: hänen tiedostonsa, tunnistetietonsa ja agenttinsa
ovat erillään muiden käyttäjien tiedoista. Natiivien työkalujen rinnalle ei
rakenneta toista historiaa tai työtilarekisteriä.

Käyttöliittymä on suomenkielinen ja toimii työpöydällä ja puhelimessa,
vaaleana ja tummana. Järjestelmän teema on oletus.

Tämä sivu kuvaa tuotteen tavoitetta ja käyttökulkuja.
[Arkkitehtuuri](architecture/index.md) kuvaa nykyisen toteutuksen;
työn tilanne ja avoimet valinnat ovat [TODO.md](../TODO.md)-tiedostossa ja issueissa.

## Ensimmäinen käyttökerta

Palvelimen osoite määrää, mihin käyttäjä kirjautuu. GitHub-kirjautuminen
valmistelee sekä selainistunnon että käyttäjän natiivin GitHub-käytön.
Palvelimen ylläpitäjä päättää pääsystä; käyttäjä ei valitse Linux-tunnusta
selaimessa. Valinnainen Google-kirjautuminen näkyy vain, kun se on otettu
käyttöön. Se tunnistaa käyttäjän selainta varten eikä korvaa natiivien
palvelujen kirjautumisia.

Kirjautuminen säilyy tavallisessa käytössä sekä gatewayn uudelleenkäynnistysten
ja päivitysten yli. Käyttäjää ei pyydetä kirjautumaan päivittäin uudelleen.
Istunto säilyy selaimen sulkemisen jälkeenkin: käyttämättömyyden raja on
90 päivää ja ehdoton raja yksi vuosi kirjautumisesta. Uloskirjautuminen tai
ylläpitäjän istuntojen peruutus päättää sen. Jos palvelimen yksityinen
istuntotiedosto katoaa tai ei ole luettavissa, vanhat istunnot lakkaavat
toimimasta ja käyttäjät kirjautuvat uudelleen.
Käyttäjän poistaminen, uloskirjautumisen kokonaisuus ja pääsyn peruuttaminen
suunnitellaan erikseen myöhemmin. Niitä ei nyt laajenneta nykyisistä
uloskirjautumis- ja operaattoritoiminnoista.

GitHubilla aloittavan käyttäjän käyttöönotto etenee repoista OpenAI-
kirjautumiseen. Käyttäjä valitsee GitHub-repot, jotka tuodaan työtiloiksi
palvelimelle. Kaikki saatavilla olevat repot näkyvät oletuksena; aikarajauksen
voi ottaa itse käyttöön. Myös valitsematta yhtään repoa voi jatkaa.
Kloonaus näyttää etenemisensä ja kustakin reposta varmistetun tuloksen.
Jo olemassa olevaa vastaavaa työtilaa ei tarvitse kloonata uudelleen.

OpenAI-vaihe yhdistää käyttäjän ChatGPT-tilauksen Pi:n kautta. Selain näyttää
kirjautumislinkin ja kopioitavan koodin, ja käyttäjä vahvistaa kirjautumisen
palveluntarjoajan sivulla. Pi hoitaa tunnusten tallentamisen ja uusimisen
käyttäjän Unix-tilillä; terminaalia ei tarvita. Koodin valmistuminen näkyy
odotuksena. Paluu palveluntarjoajan sivulta ei vielä tarkoita onnistumista:
työtilat, historia ja agentin ohjaus avautuvat, kun Pi:n tunnukset on todettu
käyttökelpoisiksi. API-avaimet ja muut kirjautumistavat ovat myöhempää työtä.

Käyttöönoton voi keskeyttää ja kirjautua ulos. Palatessa tarkistetaan natiivien
kirjautumisten ja työtilojen nykytila. Samassa selainistunnossa jo saavutettu
Pi-vaihe säilyy sivun lataamisen yli. Epäselvä kirjautuminen tai kloonaus
selvitetään ennen uutta yritystä, jotta samaa työtä ei aloiteta kahdesti.
Palaava käyttäjä, jonka Pi-tunnukset ovat kunnossa, pääsee suoraan työtiloihin.
[Käyttöönoton päätökset](../issues/design-first-use-onboarding/item.md) on
kirjattu issueen, ja ruutujen sovitus designiin on
[align-onboarding-design](../issues/align-onboarding-design/item.md)-työtä.

## Työhön palaaminen ja navigointi

Sivupalkki näyttää käyttäjän `~/src`-hakemistosta löydetyt työtilat ja niiden
keskustelut. Tavallinen hakemisto kelpaa työtilaksi ilman Gitiä tai
asetustiedostoa. Listaa voi suodattaa, ja piilotetut työtilat voi palauttaa
näkyviin. Tyhjä lista, lataus ja hakemiston lukemisen epäonnistuminen erottuvat
toisistaan.

**Etusivu** vie paluunäkymään, josta käyttäjä löytää käynnissä olevat ja
äskettäin avatut keskustelunsa. Työpöydällä sivupalkin voi kaventaa kaistaksi;
puhelimessa navigaatio avautuu keskustelun päälle. Työtilan ja keskustelun
valinta näkyy selaimen osoitteessa, jotta niihin voi palata linkillä, sivun
uudelleenlatauksella tai selaimen takaisin-toiminnolla.

Ensimmäinen keskustelun avaus hakee sen tilan ja historian ennen sisällön
näyttämistä. Historia alkaa tuoreimmasta sisällöstä, ja vanhempaa voi lukea
lisää. Äskettäin avattuun keskusteluun palataan saman välilehden muistissa
olevasta näkymästä ilman uutta lataustilaa. Luonnos ja lukukohta säilyvät.
Jos sisältö ei enää ole muistissa tai sen ajantasaisuus on menetetty,
tarvittavat tiedot haetaan uudelleen. Puuttuva keskustelu erotetaan sellaisesta,
jonka tietoja ei juuri nyt pystytä lukemaan.

Historian avaaminen ei käynnistä agenttia. Uusi keskustelu aloitetaan
erikseen. Päättynyttä selainkeskustelua voi jatkaa samalla historialla,
kun aiemman työn tiedetään päättyneen. Terminaalissa aloitetut keskustelut
ovat selaimessa vain luettavia. Selaimen käynnistämät kirjoittajat käyttävät
yhteistä lukkoa. Ennen päättyneen selainkeskustelun jatkamista daemon tarkistaa
saman käyttäjän Pi-prosessit ja estää jatkamisen, jos kirjoittajasta ei saada
varmuutta. Terminaalissa tarkistuksen jälkeen käynnistyvä Pi ei kuitenkaan
noudata selaimen lukkoa; eri kirjoittajien ehdotonta poissulkemista ei luvata.

## Keskustelu ja työn ohjaus

Käyttäjä kirjoittaa viestin ja lähettää sen Pi:lle. Lähetyksestä näkyy,
odotetaanko kuittausta vai hylättiinkö viesti. Hyväksytty lähetys tyhjentää
lähetetyn luonnoksen; hylätty tai epävarma lähetys säilyttää tekstin.
Tavallinen onnistuminen ei tarvitse pysyvää ilmoitusta. Käyttäjä seuraa
vastausta ja työkalujen etenemistä keskustelussa.

Pi:n työskennellessä **Ohjaa** antaa lisäohjeen kesken työn Pi:n omalla
ajoituksella, työkalukutsujen välissä. Se ei keskeytä käynnissä olevaa
työkalua. **Lähetä** jonottaa viestin käsiteltäväksi työn valmistuttua.
Ohjaus- ja jatkoviestien jonot näkyvät erillisinä alkuperäisessä järjestyksessä.
Enter käyttää valittua lähetystapaa; jonon tyhjennyttyä oletuksena on
valmistumisen jälkeen lähettäminen. Shift+Enter lisää rivinvaihdon.

Koko jonon voi tyhjentää. Viestikenttään palautetaan alkuperäisessä
järjestyksessä vain tekstit, joiden poistuminen on vahvistettu. Yksittäisten
jonoviestien peruminen tai järjestely ei kuulu sovittuun toimintaan.
**Keskeytä** pyytää Pi:tä keskeyttämään nykyisen vuoron. Tulos näytetään sen
mukaan, mitä tiedetään: Pi:n keskeytys ei yksin osoita kaikkien sen
käynnistämien prosessien päättyneen.

Selain toteuttaa jo Pi-kysymysten vastaamisen ja perumisen. Niiden kuuluminen
sovittuun tuotelaajuuteen on vielä
[avoin valinta](../issues/rethink-project-docs/item.md).
Tuettu kysymys voi pyytää tekstiä, valintaa tai vahvistusta. Tuntematon
kysymystyyppi näytetään tekstinä ja sen voi perua. Vastauksen vastaanotto
palvelimella ei vahvista, että Pi käsitteli sen; epäselvää vastausta ei
lähetetä automaattisesti uudelleen.
[Dialogien selainohjaus](../issues/show-pi-dialogs/item.md) kuvaa toteutuksen.

Keskustelun otsikko alkaa tekstistä **Uusi keskustelu**. Sisällöstä muodostetaan
otsikko erillisellä mallikutsulla, ja sitä voidaan tarkentaa aiheen selkiytyessä
sekä käyttäjän pyynnöstä otsikon vierestä. Otsikko ei vaihdu jokaisesta viestistä.
Epäonnistuminen säilyttää edellisen otsikon tai ensimmäisen viestin lyhyen alun,
eikä otsikointi estä keskustelua. Otsikko on Pi:n natiivi istuntonimi, joten
sama nimi näkyy myös terminaalin istuntolistassa. Olemassa olevaa nimeä ei
vaihdeta automaattisesti. Tarkempi toiminta on
[otsikointityössä](../issues/generate-conversation-titles/item.md).

## Sisällön lukeminen ja agentin tila

Historia ja reaaliaikainen keskustelu esittävät saman sisällön samoilla
merkityksillä. Käyttäjälle tarkoitettu teksti, kuvat, ajattelusisältö,
työkalukutsut ja niiden tulokset sekä tiivistelmät säilyvät luettavina siinä
järjestyksessä ja niillä yhteyksillä, joilla Pi ne tuottaa. Salattua
ajatteludataa tai sisäisiä teknisiä tietoja ei esitetä keskusteluviesteinä.
Tuntematon sisältö saa hillityn esityksen, jonka tarkemmat turvalliset tiedot
voi avata tarvittaessa.

Markdown ja koodi ovat luettavia, ja koodin voi kopioida. Työkalukutsu,
sen eteneminen ja tulos kuuluvat yhteen. Pi:n `edit`-työkalun toimittama
rakenteinen muutos näytetään diffina; muiden työkalujen tulos siinä muodossa,
jonka ne tarjoavat. Pitkää tulosta voi avata lisää menettämättä fokusta,
tekstin valintaa tai lukukohtaa. Sisällön HTML tai ohjelmakoodi ei suoritu
käyttöliittymässä.

Agentin tila vastaa käyttäjän eri kysymyksiin: onko prosessi käynnissä,
tekeekö agentti työtä, odottaako se käyttäjää ja voiko sitä ohjata selaimesta?
Pelkkä käynnissä oleva prosessi ei todista työskentelyä, eikä katkennut yhteys
tarkoita agentin pysähtyneen. Esitys perustuu hostin tuntemiin tietoihin.
[Design](../design-system/design.md) ja hyväksytty
[kontrollien ja agenttitilojen suunnitelma](../issues/design-control-states/item.md)
kuvaavat yhteiset merkitykset ja esityksen sivupalkissa, agenteissa ja
keskustelussa. Ehdollisten tilojen näyttäminen edellyttää niitä tukevia
tietoja hostilta; esityksen toteutus kuuluu
[omaan tehtäväänsä](../issues/apply-control-state-design/item.md).

Huomiota tarvitsevat keskustelut näkyvät sovelluksen omassa lukumäärässä,
agenttirivin tekstimerkissä ja selainvälilehden otsikon luvussa. Pelkkä väri
tai taustavälilehden otsikko ei ole ainoa merkki. Selain- ja
käyttöjärjestelmäilmoitukset jäävät myöhemmäksi.

Keskustelu vierii uuden sisällön mukana vain, jos käyttäjä oli jo alhaalla.
Vanhempaa sisältöä lukeva näkee **Uutta sisältöä** -ilmaisimen, ja
**Viimeisimpään** vie keskustelun loppuun. Lukukohta ja avatut työkaluryhmät
säilyvät saman keskustelun päivityksissä, kun vastaava historian kohta on
edelleen saatavilla.

Kullakin keskustelulla on oma luonnoksensa. Se säilyy samassa välilehdessä
sivun lataamisen yli, mutta ei välilehden sulkemisen yli. Luonnoksia ei
tallenneta palvelimelle. Käyttäjän keskusteluvalinta tai onnistunut luonti
tai jatkaminen voi siirtää fokuksen viestikenttään. Taustapäivitys, uusi
otsikko tai listan järjestyksen muutos ei siirrä sitä. Dialogin sulkeminen
palauttaa fokuksen mielekkääseen paikkaan.

## Työtilojen ja keskustelujen hallinta

Käyttäjä voi luoda tavallisen hakemiston tai paikallisen Git-repon työtilaksi,
kloonata repon GitHubista tai ottaa Gitin käyttöön myöhemmin. Paikalliselle
repolle voi myös luoda GitHub-etärepon. Luotu työtila avataan, ja sovittuun
luontikulkuun voi kuulua ensimmäisen agentin käynnistys ja siirtyminen
viestikenttään. Työtilan näyttönimi ja sen omat asetukset tallentuvat työtilaan.

Git-työtilan käyttö edellyttää repon ja agentin natiivin Git-käytön valmiuden
varmistamista. Puuttuva käyttöoikeus tai epäonnistunut valmistelu näkyy syineen,
jotta käyttäjä voi korjata sen. Kirjautuminen yksin ei todista, että agentti
pystyy käyttämään kyseistä repoa.

Agentille voi valmistella oman työhaaran Git-työtilasta. Taskfleet luo ja
hallitsee sitä varten erillisen työhakemiston eli worktreen. Muualta löydetyt
worktreet voivat näkyä havaintoina; niiden hallinta ei siirry selaimelle.
Taskfleet määrää lopullisen haaran nimen.

Työtilan piilotus poistaa sen tavallisesta listasta ja jättää tiedostot
paikalleen. Piilotuksen voi perua. Poisto näyttää työtilan sekä siihen
liittyvät prosessit ja worktreet ennen vahvistusta. Epäselvä vaikutus,
pysäyttämätön prosessi tai jäljellä oleva linkitetty worktree estää poiston.
Taskfleet purkaa omat worktreensä; työtilan ulkopuolisia hakemistoja ei
poisteta hiljaisesti. Symlinkit ja muualta löydetyt worktreet voivat näkyä
havaintoina, mutta ensimmäisen version kirjoittavat toiminnot eivät kohdistu niihin.

Keskustelun voi arkistoida pois aktiivisesta listasta, kun siihen ei enää
kirjoiteta. Hallittavan agentin pysäytys ja keskustelun arkistointi ovat
erilliset teot. Historia jää paikalleen, ja päättynyttä selainkeskustelua
jatketaan arkistosta samalla natiivihistorialla.

## Oma tili ja asetukset

Tilipainike näyttää etunimen ja GitHub-profiilikuvan tai kuvan varaesityksen.
Avattu tilinäkymä näyttää sähköpostin. Tiedot tulevat GitHubista;
puuttuva nimi tai sähköposti kysytään käyttöönotossa. Näyttötiedot auttavat
tunnistamaan tilin, mutta eivät muuta todennettua henkilöllisyyttä tai sitä,
kenen Unix-tiliä käytetään. [Tiliesityksen tehtävä](../issues/account-profile-from-github/item.md)
kuvaa profiilitietojen työn.

Asetuksista löytyvät tili, yhteydet tällä palvelimella, ulkoasu ja
selainistunto. GitHub- ja OpenAI-yhteyksistä näytetään, mitä niiden natiivista
tilasta tiedetään. Puuttuva kirjautuminen erotetaan tilanteesta, jossa tilaa
ei pystytä varmistamaan. Pi:n tunnusten olemassaolo ei yksin todista
palveluntarjoajalle tehdyn pyynnön onnistumista. OpenAI-kirjautumiseen käytetään
samaa Pi:n kautta kulkevaa käyttöönottoa.
[Yhteysasetusten tehtävä](../issues/add-account-settings-ui/item.md)
kuvaa yhteyksien esityksen.

Ulkoasusta voi valita vaalean, tumman tai järjestelmän teeman.
Uloskirjautuminen sulkee selainistunnon ja tyhjentää selaimesta käyttäjän
luonnokset sekä luetun sisällön. Se jättää työtilat ja palvelimen natiivit
kirjautumiset paikalleen. Jos uloskirjautumista palvelimella ei voida vahvistaa,
käyttäjä näkee epäonnistumisen ja voi yrittää uudelleen. Toisen henkilön
kirjautuessa sisään näkymät käyttävät hänen tietojaan.

## Katkos ja epävarma tulos

Yhteyden katketessa viimeksi saatu sisältö jää näkyviin. Yksi yhteysilmoitus
kertoo vanhentuneesta tiedosta; taustapäivitys ei peitä luettavaa näkymää
latausruudulla. Selain yrittää lukea uudelleen verkkoyhteyden palattua tai
käyttäjän Päivitä-toiminnosta. Uutta viestiä ei voi lähettää, kun yhteys
palvelimeen on poikki. Pelkkä tapahtumavirran katkos ei kuitenkaan tarkoita,
että palvelinyhteys on poikki. Kirjautumisen päättyminen vaatii uuden
kirjautumisen.

Pi jatkaa daemonin omistamana, vaikka selain suljetaan. Palatessa käyttäjä
näkee nykyisen työn ja katkon aikana syntyneen historian. Daemonin tai
palvelimen sammuminen voi sen sijaan katkaista aktiivisen työn.

Normaali lähetys näkyy kuittausta odottavana. Jos kuittaus katoaa, käyttäjä
näkee lähetysvirheen. Yhteyden palattua käyttöliittymä tarkistaa lähetyksen
tuloksen automaattisesti ennen kuin uusi lähetys sallitaan. Tekstin voi ottaa
talteen; viestiä ei lähetetä automaattisesti uudelleen, sillä sama työ voisi
muuten käynnistyä kahdesti. Luonnos ja lukukohta säilyvät yhteyden
palautuessa.

Työtilan luonti, GitHub-toiminto, Taskfleet-worktree ja poisto voivat onnistua
vain osittain. Käyttäjä näkee valmistuneet vaiheet, virheen ja jäljelle jääneet
vaikutukset. Uusinta perustuu tuoreeseen natiiviin tilanteeseen. Peruuttaminen
ei tarkoita, että jo tehdyt muutokset olisi kumottu.

GitHub-kloonauksen vaihevirralla on oma
[katkokäytöksensä](architecture/workspaces.md): selainyhteyden katkeaminen
keskeyttää kirjoituksen ja paluu tarkistaa Gitistä, mitä jäi jäljelle.
Kloonausta ei aloiteta automaattisesti uudelleen.

## Käytettävyys ja tarkemmat lähteet

Näppäimistöllä ja ruudunlukijalla on voitava käyttää samoja toimintoja.
Pitkä sisältö, zoomaus ja vähennetty liike eivät saa peittää toimintoja tai
kadottaa lukukohtaa. Tilat kerrotaan tekstillä tai muulla väristä riippumattomalla
merkillä; ruudunlukijalle ilmoitetaan mielekkäät muutokset jokaisen saapuvan
tekstipalan sijaan.

[Design](../design-system/design.md) ja [vedokset](../design-system/drafts/)
kuvaavat näkymien sommittelun ja visuaalisen esityksen.
[Komponenttikartta](../design-system/components.md) johtaa yhteisiin tuotantokomponentteihin
ja niiden katalogiin. [HTTP-rajapinta](architecture/http-api.md) kuvaa tietojen ja
komentojen merkityksen.

## Käyttö ja laajuus

Asennuksen, päivityksen ja palautumisen pitää säilyttää käyttäjien natiivihistoria,
Git-tila ja työtilojen asetukset. SSH- ja tmux-käyttö säilyvät selaimen rinnalla.
[Asennus](architecture/deployment.md) erottaa tuotepaketin konkreettisesta
palvelinasennuksesta.

Usean palvelimen navigointi, muut agenttiharnessit, prosessikeskus sekä
laajemmat editori- ja työkalunäkymät odottavat erillistä valintaa.
Sovelluskohtaiset käyttöönotot ovat myöhempää työtä.
