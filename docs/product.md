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

Tämä sivu kuvaa tuotteen tavoitetta ja käyttökulkuja, ei toteutuksen tilaa:
nykyisen toteutuksen kertoo koodi, ja työn tilanne ja avoimet valinnat ovat
[TODO.md](../TODO.md)-tiedostossa ja issueissa.

## Ensimmäinen käyttökerta

Palvelimen osoite määrää, mihin käyttäjä kirjautuu. GitHub-kirjautuminen
valmistelee sekä selainistunnon että käyttäjän natiivin GitHub-käytön.
Palvelimen ylläpitäjä päättää pääsystä; käyttäjä ei valitse Linux-tunnusta
selaimessa.

Kirjautuminen säilyy tavallisessa käytössä sekä gatewayn uudelleenkäynnistysten
ja päivitysten yli. Käyttäjää ei pyydetä kirjautumaan päivittäin uudelleen.
Istunto säilyy selaimen sulkemisen jälkeenkin: käyttämättömyyden raja on
90 päivää ja ehdoton raja yksi vuosi kirjautumisesta. Uloskirjautuminen tai
ylläpitäjän istuntojen peruutus päättää sen. Jos palvelimen yksityinen
istuntotiedosto katoaa tai ei ole luettavissa, vanhat istunnot lakkaavat
toimimasta ja käyttäjät kirjautuvat uudelleen.
Uloskirjautuminen päättää selainistunnon, ei natiivien työkalujen
kirjautumisia.

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
käyttökelpoisiksi.

Käyttöönoton voi keskeyttää ja kirjautua ulos. Palatessa tarkistetaan natiivien
kirjautumisten ja työtilojen nykytila. Samassa selainistunnossa jo saavutettu
Pi-vaihe säilyy sivun lataamisen yli. Epäselvä kirjautuminen tai kloonaus
selvitetään ennen uutta yritystä, jotta samaa työtä ei aloiteta kahdesti.
Palaava käyttäjä, jonka Pi-tunnukset ovat kunnossa, pääsee suoraan työtiloihin.

## Työhön palaaminen ja navigointi

Sivupalkin yläosa kertoo, mikä on nyt kesken kaikissa työtiloissa.
**Sinun vuorosi** listaa keskustelut, joissa agentti kysyy jotain tai on
vastannut ja vastaus on lukematta. **Käynnissä** listaa keskustelut, joissa
on työ kesken: työskentelevät ja ne, jotka odottavat taustatyötä (prosessia
tai workeria), ja kertoo, mitä ne odottavat. Keskustelu, jonka vuoro on
päättynyt, on valmis, vaikka Pi olisi yhä auki odottamassa viestiä, ja
palaa Käynnissä-listaan vasta, kun sen agentti työskentelee taas. Myös
työ, joka päättyi virheeseen, kaatui tai katkesi kesken esimerkiksi
päivityksen vuoksi, pysyy Käynnissä-listassa näkyvissä, kunnes käyttäjä
jatkaa tai arkistoi keskustelun. Rivillä
näkyy keskustelun otsikko, työtila ja tila. Worker näkyy omana rivinään eikä
vanhempansa alla; vanhemman rivin merkki kertoo, että sen worker työskentelee.

**Hiljaiset** listaa kaikki muut keskustelut, myös päättyneet
worktree-keskustelut, yhtenä listana ilman työtilaotsikoita, uusin ensin.
Lista säilyy tauon, Pi:n levon ja palvelimen uudelleenkäynnistyksen yli;
arkistoidut eivät ole mukana. Kuvakkeiden kanssa rivin alussa on työtilan
kuvake, ilman niitä rivillä on hiljaisesti työtilan nimi. Otsikon
kuvakeruudukosta voi järjestää listan uusimman, työtilan tai nimen mukaan ja
rajata sen yhteen työtilaan; yhtä työtilaa katsottaessa työtilajärjestystä ei
tarjota, ja valittu järjestys palaa, kun palataan kaikkiin. Järjestys ja
rajaus seuraavat käyttäjää laitteelta toiselle. Osion voi taittaa, mikä on
laitekohtainen valinta: taitettuna näkyvät avoimen keskustelun rivi ja
työtilojen kuvakepillerit, joista pääsee suoraan yhden työtilan listaan. Avoin
keskustelu erottuu kaikissa osioissa renkaalla, ja se pysyy näkyvissä listan
lopussa, vaikka rajaus muuten piilottaisi sen. Editorin kapeassa
pistepalkissa Hiljaisia ei näytetä.

Näiden alla ovat käyttäjän `~/src`-hakemistosta löydetyt työtilat
aakkosjärjestyksessä, jotta työtila löytyy joka kerta samasta kohdasta.
Tavallinen hakemisto kelpaa työtilaksi ilman Gitiä tai asetustiedostoa.
Työtilan rivillä on pieni vihje siitä, odottaako siellä jokin käyttäjää tai
onko siellä työtä käynnissä. Rivi vie työtilan sivulle, jolla ovat sen
keskustelut, myös valmiit; sivupalkki ei luettele niitä työtilan alla. Listaa
voi suodattaa, ja arkistoidut työtilat ovat taitettuna listan lopussa, josta
ne voi palauttaa; suodatin löytää myös ne. Tyhjä lista, lataus ja hakemiston
lukemisen epäonnistuminen erottuvat toisistaan.

Yhden työtilan käyttäjällä on sama näkymä ja sivupalkki kuin muillakin.
Yhden rivin listaa, suodatinta ja Työtilat-otsikkoa ei näytetä, vaan
sivupalkin alareunassa on hiljaisesti työtilan nimi, joka vie sen sivulle,
ja *Lisää työtiloja*. Toinen työtila tuo listan takaisin.

**Etusivu** vie paluunäkymään, josta käyttäjä löytää käynnissä olevat ja
äskettäin avatut keskustelunsa. Työpöydällä sivupalkin voi kaventaa kaistaksi,
jossa Sinun vuorosi- ja Käynnissä-keskustelut näkyvät työtilan kirjaimina ja
tilamerkkeinä; kaistan työtilapainike levittää palkin. Puhelimessa navigaatio
avautuu keskustelun päälle, ja valikkopainikkeessa on määrä, kun jokin odottaa
käyttäjää. Työtilan ja keskustelun valinta näkyy selaimen osoitteessa, jotta
niihin voi palata linkillä, sivun uudelleenlatauksella tai selaimen
takaisin-toiminnolla.

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

Pi-kysymyksiin voi vastata ja ne voi perua selaimessa. Tuettu kysymys voi pyytää tekstiä, valintaa tai vahvistusta. Tuntematon
kysymystyyppi näytetään tekstinä ja sen voi perua. Vastauksen vastaanotto
palvelimella ei vahvista, että Pi käsitteli sen; epäselvää vastausta ei
lähetetä automaattisesti uudelleen.

Keskustelun otsikko alkaa tekstistä **Uusi keskustelu**. Sisällöstä muodostetaan
otsikko erillisellä mallikutsulla, ja sitä voidaan tarkentaa aiheen selkiytyessä
sekä käyttäjän pyynnöstä otsikon vierestä. Otsikko ei vaihdu jokaisesta viestistä.
Epäonnistuminen säilyttää edellisen otsikon tai ensimmäisen viestin lyhyen alun,
eikä otsikointi estä keskustelua. Otsikko on Pi:n natiivi istuntonimi, joten
sama nimi näkyy myös terminaalin istuntolistassa. Olemassa olevaa nimeä ei
vaihdeta automaattisesti.

Käyttäjä voi pyytää keskustelusta tiivistelmän. Pi voi tehdä sellaisen myös
työn rauhoituttua. Se näkyy viestikentän yläpuolella, ja uudet viestit
merkitsevät vanhan tiivistelmän vanhentuneeksi. Tiivistelmä tallentuu Pi:n
historiaan, ei erilliseen selaimen muistioon.

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
[Design](../design-system/design.md) kuvaa yhteiset merkitykset ja esityksen
sivupalkissa, agenteissa ja keskustelussa. Ehdollisten tilojen näyttäminen
edellyttää niitä tukevia tietoja hostilta.

Huomiota tarvitsevat keskustelut näkyvät sovelluksen omassa lukumäärässä,
agenttirivin tekstimerkissä ja selainvälilehden otsikon luvussa. Pelkkä väri
tai taustavälilehden otsikko ei ole ainoa merkki.

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

Worktree-agentissa Git-työtilasta luodaan tavallinen
`git worktree` omalle haaralleen, ja siinä käydään tavallisia
selainkeskusteluja. Haaran yhdistäminen tai hylkääminen pyydetään agentilta;
yläpalkki näyttää Gitin tilan. Työtilan sivu ja Asetukset › Tallennustila
listaavat kaikki worktreet, ja niitä voi siivota pois tai poistaa pakolla.

Työtilan piilotus poistaa sen tavallisesta listasta ja jättää tiedostot
paikalleen. Piilotuksen voi perua. Poisto siirtää työtilan roskakoriin, josta
sen voi palauttaa; lopullinen poisto tehdään vain roskakorista erikseen
pyytäen. Puhdas, kokonaan pushattu klooni poistetaan suoraan. Ennen poistoa
näytetään työtila sekä siihen liittyvät prosessit ja worktreet. Epäselvä
vaikutus, pysäyttämätön prosessi tai jäljellä oleva linkitetty worktree estää
poiston.
Taskfleet purkaa omat worktreensä; työtilan ulkopuolisia hakemistoja ei
poisteta hiljaisesti. Symlinkit ja muualta löydetyt worktreet voivat näkyä
havaintoina, mutta kirjoittavat toiminnot eivät kohdistu niihin.

Keskustelun voi arkistoida pois aktiivisesta listasta, kun siihen ei enää
kirjoiteta. Hallittavan agentin pysäytys ja keskustelun arkistointi ovat
erilliset teot. Historia jää paikalleen, ja päättynyttä selainkeskustelua
jatketaan arkistosta samalla natiivihistorialla.

## Oma tili ja asetukset

Tilipainike näyttää etunimen ja GitHub-profiilikuvan tai kuvan varaesityksen.
Avattu tilinäkymä näyttää sähköpostin. Tiedot tulevat GitHubista;
puuttuva nimi tai sähköposti kysytään käyttöönotossa. Näyttötiedot auttavat
tunnistamaan tilin, mutta eivät muuta todennettua henkilöllisyyttä tai sitä,
kenen Unix-tiliä käytetään.

Asetuksista löytyvät tili, yhteydet tällä palvelimella, ulkoasu ja
selainistunto. GitHub- ja OpenAI-yhteyksistä näytetään, mitä niiden natiivista
tilasta tiedetään. Puuttuva kirjautuminen erotetaan tilanteesta, jossa tilaa
ei pystytä varmistamaan. Pi:n tunnusten olemassaolo ei yksin todista
palveluntarjoajalle tehdyn pyynnön onnistumista. OpenAI-kirjautumiseen käytetään
samaa Pi:n kautta kulkevaa käyttöönottoa.

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

Työtilan luonti, GitHub-toiminnot sekä worktreen luonti ja siivous voivat
onnistua vain osittain.
Käyttäjä näkee valmistuneet vaiheet, virheen ja jäljelle jääneet vaikutukset.
Uusinta perustuu tuoreeseen natiiviin tilanteeseen. Peruuttaminen ei tarkoita,
että jo tehdyt muutokset olisi kumottu.

GitHub-kloonaus on käyttäjän daemonin työ, joka jatkuu, vaikka selain
poistuu sivulta tai yhteys katkeaa. Keskeytynyt kloonaus tunnistetaan
tiedostojärjestelmästä, ja se aloitetaan alusta tai poistetaan vain
käyttäjän pyynnöstä.

## Käytettävyys ja tarkemmat lähteet

Näppäimistöllä ja ruudunlukijalla on voitava käyttää samoja toimintoja.
Pitkä sisältö, zoomaus ja vähennetty liike eivät saa peittää toimintoja tai
kadottaa lukukohtaa. Tilat kerrotaan tekstillä tai muulla väristä riippumattomalla
merkillä; ruudunlukijalle ilmoitetaan mielekkäät muutokset jokaisen saapuvan
tekstipalan sijaan.

[Design](../design-system/design.md) ja [vedokset](../design-system/drafts/)
kuvaavat näkymien sommittelun ja visuaalisen esityksen.

## Käyttö ja laajuus

Asennuksen, päivityksen ja palautumisen pitää säilyttää käyttäjien natiivihistoria,
Git-tila ja työtilojen asetukset. SSH- ja tmux-käyttö säilyvät selaimen rinnalla.
[Asennusopas](operations.md) erottaa tuotepaketin konkreettisesta
palvelinasennuksesta.

Tuotteen ulkopuolella ovat toistaiseksi usean palvelimen navigointi, muut
agenttiharnessit kuin Pi, laajemmat editori- ja työkalunäkymät, selain- ja
käyttöjärjestelmäilmoitukset, valinnainen Google-kirjautuminen selainta varten
sekä käyttäjän poistaminen palvelimelta. Niistä päätetään erikseen.
