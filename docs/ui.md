# Käyttöliittymän käyttökulut

Käyttäjä avaa työtilansa, valitsee keskustelun ja jatkaa työtään Pi:n kanssa.
Työtilat ja keskustelut näkyvät vasemmalla, valitun keskustelun sisältö oikealla.
Käyttäjä voi seurata vastausta, lukea aiempaa työkalutulosta tai vaihtaa toiseen
keskusteluun menettämättä luonnostaan. Auki olevan keskustelun lukukohta
säilyy taustapäivityksissä; vaihto toiseen keskusteluun avaa historian uudelleen.

Ensimmäinen käyttöliittymä on suomenkielinen työpöytänäkymä yhdelle palvelimelle.
Vaalea ja tumma teema kuuluvat siihen; järjestelmän teema on oletus.
Tämä sivu kuvaa sovittua käyttökokemusta. Kirjautuminen, työtilojen ja historian
lukeminen sekä osa selainohjauksesta on jo toteutettu. Koko käyttökulku on vielä
kesken: [rajapintasivu](interfaces.md) erottaa nykyisen ja tulevan toiminnan,
[toteutusissuet](implementation.md) sisältävät tarkistetut revisiot ja tulokset.

## Kirjautuminen ja työtilan valinta

Palvelimen osoite määrää, mihin käyttäjä kirjautuu. GitHub-kirjautuminen
valmistelee sekä selainistunnon että käyttäjän natiivin GitHub-käytön.
Käyttäjä ei valitse Linux-tunnusta selaimessa. Valinnainen Google-kirjautuminen
näkyy vain, kun se on otettu käyttöön. Agentin käyttöön tarvittava Pi-
kirjautuminen tehdään omassa vaiheessaan.

Työtilapalkki näyttää käyttäjän `~/src`-hakemistosta löydetyt työtilat ja niihin
liittyvät keskustelut. Listaa voi suodattaa, ja piilotetut työtilat voi palauttaa
näkyviin. Lataus, tyhjä lista ja lukemisen epäonnistuminen erottuvat toisistaan.
Git-työtilan avaaminen odottaa, että integrointivaihe on varmistanut repon ja
agentin Git-käytön valmiuden. Puuttuva käyttöoikeus tai epäonnistunut valmistelu
näkyy syineen.

Keskustelun avaaminen näyttää yhden lataustilan, kunnes sekä tila että natiivi
historia on haettu. Puoliksi ladattua keskustelua ei näytetä, eikä avaaminen
käynnistä agenttia. Uusi keskustelu aloitetaan erikseen. Päättynyttä selainkeskustelua voi jatkaa
samalla historialla, kun aiemman työn tiedetään päättyneen. Terminaalissa
aloitetut keskustelut ovat vain luettavia. Samaa keskustelua ohjataan yhdestä
paikasta kerrallaan.

Valittu työtila ja keskustelu näkyvät selaimen osoitteessa, jotta sivulle voi
palata linkillä, reloadilla tai selaimen takaisin-toiminnolla. Puuttuva kohde
ja kohde, jonka tilaa ei juuri nyt pystytä lukemaan, näytetään eri tilanteina.
Työtilaan palaaminen ei itsessään käynnistä keskustelua.

## Viesti, vastaus ja työn ohjaus

Viestin lähettämisestä näkyy, odotetaanko kuittausta, hyväksyttiinkö viesti vai
hylättiinkö se. Hyväksytty lähetys tyhjentää lähetetyn luonnoksen; hylätty tai
epävarma lähetys säilyttää tekstin. Käyttäjä näkee vastauksen ja työkalujen työn
etenemisen sekä mahdollisen keskeytyksen tai virheen.

Pi:n työskennellessä käyttäjä voi antaa lisäohjeen **Ohjaa tämän vuoron jälkeen**
-toiminnolla tai jonottaa viestin **Suorita valmistumisen jälkeen** -toiminnolla.
Ohjaus noudattaa Pi:n omaa ajoitusta eikä keskeytä käynnissä olevaa työkalua.
Jonot näkyvät erillisinä ja alkuperäisessä järjestyksessä. Koko jonon voi
tyhjentää; editoriin palautetaan vain tekstit, joiden poistuminen on vahvistettu.
Yksittäisten jonoviestien perumista tai järjestelyä ei luvata. Lähetys käyttää
valittua tapaa; jonon tyhjennyttyä oletus on valmistumisen jälkeen lähettäminen.

Vuoron keskeytys on erillinen toiminto. Käyttöliittymä näyttää sen todellisen
tuloksen: Pi:n keskeytys ei yksin osoita jokaisen sen käynnistämän prosessin
päättyneen. Keskustelun arkistointi edellyttää, ettei siihen enää kirjoiteta.
Arkistosta jatkaminen käyttää samaa natiivihistoriaa.

Kaikki saapuvat viestit ja kysymykset näytetään. Jos sisältötyypille ei ole omaa
esitystapaa, sisältö on luettavissa turvallisena tekstinä. Pi:n erillisen
kysymysdialogin tekstiin voi vastata tai pyynnön perua
keskustelussa. Tuntemattoman dialogityypin voi vain perua. Vastauksen
vastaanotto ei vahvista, että Pi käsitteli sen: epäselvää pyyntöä ei
lähetetä uudelleen automaattisesti.

Markdown, koodi ja ryhmitellyt työkalutulokset pysyvät luettavina, ja koodin voi
kopioida. Pi:n `edit`-työkalun toimittama rakenteinen muutos näytetään diffina.
Muiden työkalujen tulos näytetään siinä muodossa, jonka ne tarjoavat.
Pitkää tulosta voi avata lisää ilman, että fokus, tekstin valinta tai lukukohta
katoaa. Agentin sisältämä HTML tai ohjelmakoodi ei suoritu käyttöliittymässä.

## Luonnokset, lukukohta ja huomio

Kullakin keskustelulla on oma luonnoksensa. Se säilyy samassa välilehdessä
sivun lataamisen yli, mutta ei välilehden sulkemisen yli. Uloskirjautuminen tai
käyttäjän vaihtuminen tyhjentää aiemman käyttäjän luonnokset ja luetun sisällön.
Luonnoksia ei tallenneta palvelimelle.

Käyttäjän keskusteluvalinta tai onnistunut luonti tai jatkaminen voi siirtää
fokuksen viestikenttään. Taustapäivitys, uusi otsikko tai listan järjestyksen
muutos ei siirrä sitä. Dialogin sulkeminen palauttaa fokuksen mielekkääseen
paikkaan.

Keskustelu vierii uuden sisällön mukana vain, jos käyttäjä oli jo alhaalla.
Aiemman sisällön lukija saa **Uutta sisältöä** -ilmaisimen. Lukukohta ja avatut työkaluryhmät säilyvät saman keskustelun päivityksessä,
kun vastaava natiivi tapahtuma on edelleen saatavilla.

Huomiota tarvitsevat keskustelut näkyvät sovelluksen omassa lukumäärässä,
agenttirivin tekstimerkissä ja selainvälilehden otsikon luvussa. Pelkkä väri tai
taustavälilehden otsikko ei ole ainoa merkki. Selain- ja käyttöjärjestelmä-
ilmoitukset jäävät myöhemmäksi.

Keskustelun otsikko alkaa tekstistä **Uusi keskustelu**. Sisällöstä muodostetaan
otsikko erillisellä mallikutsulla, ja sitä voidaan tarkentaa aiheen selkiytyessä
sekä käyttäjän pyynnöstä otsikon vierestä. Otsikko ei vaihdu jokaisesta viestistä.
Epäonnistuminen säilyttää edellisen otsikon tai ensimmäisen viestin lyhyen alun,
eikä otsikointi estä keskustelua. Tarkka toiminta on
[otsikointisopimuksessa](interfaces.md#ohjauskyvyt-ja-otsikointi).

## Katkos ja epävarma tulos

Yhteyden katketessa viimeksi saatu sisältö jää näkyviin. Yhteysbanneri kertoo
vanhentuneesta tiedosta, mutta näkymää ei peitetä tai asenneta uudelleen.
Ensimmäinen sivulataus näyttää lataustilan; taustapäivitys ei. Selain yrittää
lukea uudelleen verkkoyhteyden palattua tai käyttäjän Päivitä-painikkeesta.
Kirjoitus lähetetään nykyisellä istunnolla palvelimelle, joka ratkaisee sen
hyväksymisen; katkolla oleva tapahtumavirta ei yksin estä lähetystä. Pi jatkaa daemonin omistamana,
vaikka selain suljetaan. Palatessa käyttäjä näkee nykyisen työn ja katkon aikana
syntyneen historian. Daemonin tai palvelimen sammuminen voi sen sijaan katkaista
aktiivisen työn.

Normaali lähetys näkyy odottavana vastauksen ajan, ei epävarmana. Jos viestin
kuittaus katoaa, käyttöliittymä selvittää tilanteen palvelimelta.
Jos tulosta ei voida tietää, se näytetään epävarmana. Tekstin voi kopioida tai
lähettää tietoisesti uutena viestinä; automaattinen uusinta voisi teettää saman
työn kahdesti. Luonnos ja lukukohta säilyvät yhteyden palautuessa.

Työtilan luonti, GitHub-toiminto, Taskfleet-worktree ja poisto voivat onnistua
vain osittain. Käyttäjä näkee valmistuneet vaiheet, virheen ja jäljelle jääneet
vaikutukset. Uusinta perustuu tuoreeseen natiiviin tilanteeseen. Peruuttaminen
ei tarkoita, että jo tehdyt muutokset olisi kumottu.

GitHub-kloonauksen sovitulla vaihevirralla on oma
[katkokäytöksensä](adr-0005-clone-progress-stream.md): selainyhteyden katkeaminen
keskeyttää kirjoituksen ja paluu tarkistaa Gitistä, mitä jäi jäljelle.
Kloonausta ei aloiteta automaattisesti uudelleen.

Poisto näyttää työtilan sekä siihen liittyvät prosessit ja worktreet ennen
vahvistusta. Epäselvä vaikutus, pysäyttämätön prosessi tai jäljellä oleva
linkitetty worktree estää poiston. Taskfleet hallitsee omia worktreitään;
selain ei ota mielivaltaisia worktreitä hallintaansa. Piilotus jättää tiedostot
paikalleen. Muut työtilatoiminnot kuvataan
[tuotesivulla](product.md#työtilojen-ja-keskustelujen-hallinta).

## Designin lähteet ja toteutuksen arviointi

[UI-päätös 2026-09-22](../issues/review-ui-v1/review.md) tallentaa alkuperäiset
valinnat. Nykyinen [agenttiohjauksen rajaus](../issues/build-agent-control/item.md)
ja [keskustelun toteutusissue](../issues/complete-conversation-ui/item.md)
täsmensivät terminaalihistoriat vain luettaviksi. Myöhemmin
[Pi-dialogien selainohjaus](../issues/show-pi-dialogs/item.md) lisäsi
vastauksen ja perumisen vain selaimen omiin keskusteluihin.

[Design system](design-system.md) johtaa visuaalisiin lähteisiin,
komponenttisopimuksiin ja ajettavaan katalogiin. Sovellus ja Storybook käyttävät
samoja tuotantokomponentteja. Selainpohjaksi on valittu React ja TypeScript
[ADR 0002:ssa](adr-0002-frontend-stack.md). Näkymien sommittelu ja vuorovaikutus löytyvät
[designista](../design-system/design.md); protokollan toiminta
[rajapintasivulta](interfaces.md). [Vedokset](../design-system/drafts/) näyttävät tavoitellun ulkoasun.

Näppäimistöllä ja ruudunlukijalla on voitava käyttää samoja toimintoja.
Pitkä sisältö, zoomaus ja vähennetty liike eivät saa peittää toimintoja tai
kadottaa lukukohtaa. Tilat kerrotaan tekstillä tai muulla väristä riippumattomalla
merkillä; ruudunlukijalle ilmoitetaan mielekkäät muutokset jokaisen saapuvan
tekstipalan sijaan.

Toteutusta arvioidaan toimivista käyttökuluista, testeistä ja kuvista. Kunkin
issuen näyttö kertoo, mitä tarkistettiin, millä revisiolla ja millä ympäristöllä.
Jarin visuaalinen palaute kirjataan ja korjataan työn yhteydessä. Odottava
ulkoasukatselmointi ei estä toiminnallista valmistumista tai riippumatonta työtä,
eikä erillistä lopullista MVP-hyväksyntäporttia ole. Puhelinasettelu kuuluu designiin. Usean palvelimen
navigointi ja prosessikeskus odottavat omaa päätöstään.
