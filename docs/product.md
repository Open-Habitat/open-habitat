# Tuotteen tavoite ja sovitut toiminnot

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimella oleviin
projekteihin ja AI-agentteihin. Käyttäjä avaa oman työtilansa, keskustelee
agentin kanssa ja seuraa sen työtä. Tiedostot, Git-repot ja keskusteluhistoria
pysyvät natiivien työkalujen omassa muodossa ja käytettävissä myös SSH:n ja
tmuxin kautta. Selaimen sulkeminen jättää agentin työskentelemään.

Ensimmäinen toteutus käyttää Pi:tä ja työpöytäselainta yhdellä Linux-palvelimella.
Jokainen ihminen työskentelee omalla Linux-tunnuksellaan: hänen tiedostonsa,
tunnistetietonsa ja agenttinsa ovat erillään muiden käyttäjien tiedoista.
[Natiivi arkkitehtuuri](architecture/index.md) rakentuu näiden valmiiden työkalujen
varaan, jotta niiden rinnalle ei synny toista historiaa tai työtilarekisteriä.

Tämä sivu kuvaa sovittua tavoitetta. Kirjautuminen, työtilojen ja historian
lukeminen sekä osa selainohjauksesta on jo toteutettu, mutta koko käyttökulku
on kesken. [Arkkitehtuuri](architecture/index.md) kuvaa nykyisen toteutuksen;
työn tilanne on [TODO.md](../TODO.md)-tiedostossa ja issueissa.

## Kirjautumisesta omaan työtilaan

Käyttäjä kirjautuu GitHubilla ja päätyy omalle Linux-tililleen. Sama valtuutus
valmistelee hänen natiivin GitHub-käyttönsä, jotta myös agentti voi käyttää
Gitiä. Valinnainen Google-kirjautuminen tunnistaa käyttäjän selainta varten.
Palvelimen ylläpitäjä päättää pääsystä; selain ei tarjoa Linux-käyttäjän valintaa.

Työtilalista näyttää käyttäjän `~/src`-hakemiston välittömät hakemistot.
Tavallinen hakemisto kelpaa työtilaksi ilman Gitiä tai asetustiedostoa.
Git-työtilaa avattaessa integrointivaihe varmistaa ensin repon ja sen
käyttöoikeuksien valmiuden agentin tavallisia `git pull`- ja `git push`
-komentoja varten. Jos jokin puuttuu, käyttäjä näkee syyn ja voi korjata sen.
Pelkkä onnistunut kirjautuminen ei vielä todista repon käyttövalmiutta.

Työtilassa näkyvät siihen liittyvät keskustelut ja niiden natiivihistoria.
Historian avaaminen ei käynnistä agenttia. Käyttäjä aloittaa uuden keskustelun
tai jatkaa päättynyttä selainkeskustelua erillisellä toiminnolla, joka käyttää
samaa natiivihistoriaa. Terminaalissa aloitetut keskustelut ovat selaimessa
luettavia. Keskustelua ohjaa kerrallaan yksi kirjoittaja, sillä riippumattomat
selain- ja terminaaliohjaajat voisivat kirjoittaa samaan historiaan yhtä aikaa.

## Keskustelu agentin kanssa

Käyttäjä lähettää viestin ja näkee, hyväksyttiinkö se sekä miten vastaus ja
työkalujen työ etenevät. Hän voi pyytää nykyisen vuoron keskeytystä, antaa
lisäohjeen kesken työn tai jonottaa seuraavan viestin Pi:n natiivin toiminnan
mukaisesti. Keskeytyksen todellinen tulos näkyy myös silloin, kun jonkin
käynnistetyn työkalun päättymisestä ei ole varmuutta.

Markdown, koodi, pitkät tulokset ja ryhmitellyt työkalukutsut ovat luettavia,
ja koodin voi kopioida. Pi:n tuetun `edit`-työkalun rakenteinen muutos näytetään
diffinä. Muut työkalut näyttävät tarjoamansa tuloksen. Kaikki saapuvat viestit,
kysymykset ja tuntemattomat sisältölohkot näytetään vähintään turvallisena
tekstinä. Pi:n erillisten kysymysdialogien vastaus- ja perumisohjaimet jäävät
nykyisen toteutuksen ulkopuolelle.

Keskustelulle muodostetaan sisältöä kuvaava otsikko, jota voidaan tarkentaa
aiheen selkiytyessä. Otsikointi ei keskeytä keskustelua. Luonnos, fokus,
lukukohta ja avatut työkaluryhmät säilyvät päivityksissä; uusi sisältö ei vie
lukijaa pois kohdasta, jota hän lukee. Sovellus näyttää huomiota tarvitsevat
keskustelut omassa käyttöliittymässään. Näiden toimintojen sovittu käyttötapa
löytyy [UI-päätöksestä](../issues/review-ui-v1/review.md), ja jäljellä oleva työ
[keskustelun toteutusissuesta](../issues/complete-conversation-ui/item.md).

Selainkatkon jälkeen käyttäjä palaa keskustelun nykyiseen tilaan ja näkee
katkon aikana tehdyn työn. Epävarmaksi jäänyttä viestiä ei lähetetä
automaattisesti uudelleen. Daemonin tai palvelimen sammuminen voi pysäyttää
aktiivisen työn; natiivihistoria säilyy ja jatkaminen odottaa varmuutta siitä,
ettei aiempi työ enää kirjoita samaan keskusteluun.

## Työtilojen ja keskustelujen hallinta

Sovittuun toiminnalliseen laajuuteen kuuluvat:

- **Työtilan luonti ja asetukset.** Käyttäjä luo tavallisen hakemiston tai
  paikallisen Git-repon ja voi ottaa Gitin käyttöön myöhemmin. Näyttönimi ja
  muut työtilan asetukset tallentuvat työtilaan. Sovitut luontitoiminnot voivat
  avata työtilan, käynnistää ensimmäisen agentin ja siirtää fokuksen
  viestikenttään; Git-repo kulkee ensin integrointivaiheen läpi.
- **GitHub.** Käyttäjä valitsee ja kloonaa repon työtilaksi tai luo paikalliselle
  repolle etärepon. Käyttöliittymä näyttää työn etenemisen sekä Gitistä ja
  GitHubista varmistetun lopputuloksen.
- **Oma työhaara agentille.** Käyttäjä valitsee Git-työtilasta lähtökohdan ja
  vapaan haaran nimen. Taskfleet luo ja hallitsee worktreen, jossa agentti
  työskentelee. Muualta löydetyt worktreet voivat näkyä havaintoina, mutta
  selain ei ryhdy niiden yleiseksi hallintatyökaluksi.
- **Piilotus ja poisto.** Työtilan voi piilottaa listasta ja palauttaa näkyviin
  muuttamatta sen tiedostoja. Poisto näyttää kohteen ja vaikutukset ja pyytää
  vahvistuksen. Pysäyttämätön prosessi, jäljellä oleva linkitetty worktree tai
  epäselvä vaikutus estää poiston. Taskfleet purkaa omat worktreensä;
  työtilan ulkopuolisia hakemistoja ei poisteta hiljaisesti.
- **Arkistointi ja jatkaminen.** Käyttäjä voi lopettaa hallittavan agentin ja
  arkistoida keskustelun pois aktiivisesta listasta. Arkistointi jättää
  Pi-historian paikalleen. Jatkaminen palauttaa päättyneen selainkeskustelun
  käyttöön samalla natiivilla tunnuksella.

Pitkä tai osittain epäonnistunut toiminto näyttää, mitä todella valmistui ja
mitä jäi jäljelle. Jo luotua hakemistoa ei esimerkiksi väitetä poistetuksi siksi,
että agentin käynnistys epäonnistui. Symlinkit ja mielivaltaiset worktreet
voidaan näyttää havaintoina, mutta ensimmäisen version kirjoittavat toiminnot
eivät kohdistu niihin. [Tapahtumat ja palautuminen](architecture/events-and-recovery.md)
kuvaa nykyisen katkoskäytöksen; toteutusissueissa ovat mekanismit ja testit.

## Käyttö ja eteneminen

Asennuksen, päivityksen ja palautumisen pitää säilyttää käyttäjien natiivihistoria,
Git-tila ja työtilojen asetukset. SSH- ja tmux-käyttö säilyvät selaimen rinnalla.
[Asennus](architecture/deployment.md) erottaa tuotepaketin konkreettisesta
palvelinasennuksesta.

Tuotetta kehitetään käyttöhavaintojen ja rajattujen korjausten kautta.
Toimintojen valmistuminen ja niiden todentaminen kirjataan omiin issueihinsa;
yhtä lopullista MVP-hyväksyntäporttia ei ole. Sovittu laajuus säilyy työn
suuntana, ja siihen tarvittavat muutokset päätetään Jarin kanssa.

Mobiili, usean palvelimen navigointi, muut agenttiharnessit, prosessikeskus ja
laajemmat editori- ja työkalunäkymät odottavat erillistä valintaa. Myös
sovelluskohtaiset käyttöönotot ovat myöhempää työtä.
