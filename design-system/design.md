# Käyttöliittymän design

Omega Habitat on rauhallinen työväline omien työtilojen ja agenttikeskustelujen
käyttöön. Keskustelu on pääsisältö; navigaatio, tilat ja toiminnot tukevat sen
lukemista. Käyttöliittymä toimii työpöydällä ja puhelimessa, vaaleana ja tummana.

[Vedokset](drafts/) näyttävät sommittelun ja esitystilat. Navigaation,
paluunäkymän, työtilasivun ja asetusten nykyinen viite on
[Navigaatio ja asetukset](drafts/Navigaatio%20ja%20asetukset.dc.html).
Kontrollien soveltuvat tilat ja agentin tilan esityskieli ovat
[Kontrollitilat ja agentin tila](drafts/Kontrollitilat%20ja%20agentin%20tila.dc.html)
-vedoksessa. Ehdolliset esimerkit eivät väitä hostin jo tuottavan niiden
vaatimia faktoja. Yhteiset mitat, värit, fontit ja liike ovat [tokeneissa](tokens/), joita sovellus käyttää
`styles.css`:n kautta. [Komponenttikartta](components.md) johtaa samoihin
komponentteihin, jotka näkyvät sovelluksessa ja Storybookissa.
[Käyttökulut](../docs/product.md) kuvaavat toiminnan ja
[arkkitehtuuri](../docs/architecture/index.md) hostin tarjoaman tiedon.
[Design-kierros](process.md) kertoo, miten vedokset, tämä kuvaus ja koodi
pidetään samassa totuudessa.

## Ilme

Oletustila on hiljainen. Käynnissä oleva työ, vastausta odottava kysymys,
vain luku -tila, katkos ja epävarma tulos saavat tunnistettavan esityksen.
Tila näkyy merkin, sanan ja värin avulla; onnistuneesta lähetyksestä tai
tyhjästä jonosta ei synny pysyvää ilmoitusta. Agentin odotus on ontto rengas;
vain luku on erillinen katkoviivatagi tai kentän katkoviivareuna. Agentin aktiivisuus, uuden vastauksen tai virheen
huomio, kirjoitusoikeus ja operaation tulos ovat eri kanavia ja voivat näkyä
samanaikaisesti. Nykyinen reitti on neutraali pinta, ei huomiomerkki.
Epävarma lähetys on hillitty katkoviivalaatikko ja lyhyt lähetysvirhe, ei
väite siitä, ettei viestiä toimitettu. Vahvistettu virhe erottuu siitä.
Kun host ei tiedä, onko agentti suljettu, näytetään tuntematon tila eikä
*valmis*; ilman raportoitua palveluvirhettä sellaista ei näytetä.

Painikkeen yhteydessä kerrotaan epäselvän eston syy ilman hoveria myös
puhelimessa, esimerkiksi yhteyskatkon tai kirjoitusoikeuden puutteen takia.
Ilmeistä tyhjän kentän lähetysestoa ei selitetä toistuvalla ohjetekstillä.
Sama tieto annetaan saavutettavasti näppäimistöllä ja ruudunlukijalla;
fokusoitavuus ratkaistaan kontrollin toiminnan perusteella, eikä kaikkia
estettyjä toimintoja pakoteta tab-järjestykseen.

Näkymässä on yksi ensisijainen toiminto kerrallaan. Toissijaiset toiminnot
ovat hillittyjä. Reunat erottavat pinnat, varjot kuuluvat kelluviin valikoihin,
laatikoihin ja viimeisimpään vievään painikkeeseen. Estetty toiminto säilyy
luettavana. Hover ja painallus syventävät saman toiminnon sävyä, eivät muuta
sitä valinnaksi. Odottava toiminto säilyttää kontrastinsa: sen tekstissä
kerrotaan mitä odotetaan, liike on vain lisävihje. Fokus näkyy molemmissa
teemoissa ja liike poistuu vähennetyn liikkeen asetuksella. Pikanäppäinten
ohje kuuluu omaan vihjeriviinsä.

Käyttöliittymä on suomeksi. Instrument Sans on ihmisen tekstille, JetBrains
Mono poluille, komennoille, repoille ja muille koneellisille tunnisteille.
Tunnisteet säilyvät siinä muodossa, jossa käyttäjä kohtaa ne terminaalissa.
Fontit tulevat tuotteen mukana. Ikonit käyttävät yhteistä ikonikomponenttia,
jotta niiden ulkonäkö ei riipu käyttöjärjestelmän fontista.

Järjestelmäteema on oletus; käyttäjä voi valita myös vaalean tai tumman teeman.
Vähennetyn liikkeen asetus poistaa pulssit ja siirtymät. Pitkä teksti ja zoomaus
saavat kasvattaa sisältöä peittämättä toimintoja.

## Sovelluskehys

Sivupalkin Etusivu vie paluunäkymään: ensin ovat uudet huomiota vaativat
keskustelut, sitten käynnissä olevat ja viimeksi avatut. Odottava agentti
vaatii huomiota, kunnes käyttäjä käy keskustelussa; käynti poistaa
huomiomerkinnän mutta ei sulje agenttia. Nähty virhe säilyy keskustelurivillä
ilman että se jää etusivun kärkeen. Valmis tarkoittaa suljettua agenttia, ei
lukematonta vastausta.

Työtilat ryhmittelevät keskustelut. Työtilan nimi avaa sen oman sivun;
erillinen nuoli avaa ja sulkee sivupalkin ryhmän. Työtilasivulla näkyvät nimi,
polku, uuden keskustelun aloitus ja keskustelut. Sivupalkin voi sulkea kapeaksi
kaistaksi, jossa keskeiset toiminnot säilyvät saatavilla. Puhelimessa sama
navigaatiosisältö avautuu valikkolaatikkoon keskustelun päälle.

Tilipainikkeessa näkyvät etunimi ja profiilikuva tai sen varaesitys.
Avattu tilinäkymä näyttää sähköpostin. Tiedot tulevat GitHubista; puuttuvat
tiedot kysytään käyttöönotossa. Asetusten osiot ovat Tili, Yhteydet tällä
palvelimella, Ulkoasu ja Istunto. Profiilitiedon toteutus kuuluu
[@account-profile-from-github](../issues/account-profile-from-github/item.md)
ja yhteyksien esitys
[@add-account-settings-ui](../issues/add-account-settings-ui/item.md) -työhön.

## Keskustelu

Keskustelun yläpalkissa ovat otsikko, olennainen tila ja Tiedot-valikko.
Tekniset tiedot avautuvat siitä. Viestit, työkalurivit ja kirjoituskenttä
noudattavat yhteistä palstaa. Kopiointi on hiljainen toiminto viestin tai
koodilohkon yhteydessä.

Uusi avaus näyttää tuoreimman sisällön. Keskusteluun palatessa lukukohta ja
luonnos säilyvät. Käyttäjän lukiessa vanhempaa sisältöä saapuva vastaus ei
vieritä näkymää; Viimeisimpään-painike vie takaisin loppuun. Painike pysyy
näkyvänä myös kirjoituskentän kasvaessa.

Työn aikana Keskeytä pysäyttää vuoron, Ohjaa antaa ohjeen kesken työn ja
Lähetä vie viestin valmistumisen jälkeen käsiteltävään jonoon. Ero kerrotaan
kentän yhteydessä. Jonot ovat tiiviitä rivejä, joilla on yhteinen otsake ja
koko jonon tyhjennys. Tyhjennyksestä palautetaan kirjoituskenttään vain
vahvistetusti poistetut viestit.

Hylätty lähetys säilyttää tekstin korjausta varten. Jos lähetyksen kuittausta ei
saada, viestin yhteydessä näkyy lähetysvirhe ja mahdollisuus ottaa teksti
talteen. Yhteyskatkon aikana uutta viestiä ei voi lähettää; yhteyden palattua
sovellus tarkistaa aiemman lähetyksen tuloksen itse. Viestiä ei lähetetä
automaattisesti uudestaan. Sovelluksen yhteyskatkos näkyy yhdessä yläreunan
ilmoituksessa.
Taustapäivitys ei siirrä fokusta eikä korvaa luettavaa näkymää latausruudulla.

Designer suunnittelee jokaisen keskustelulohkon esitystilat. Agentti kartoittaa
lohkojen merkitykset ja toimittaa esimerkit, sitten toteuttaa ne yhteisiin
komponentteihin ja katalogiin. Käyttäjälle tarkoitettu sisältö säilyy;
salattua thinking-dataa tai teknisiä payloadeja ei esitetä viesteinä.
Tuntematon sisältö saa hillityn esityksen. Historia ja reaaliaikainen näkymä
käyttävät samoja tulkintoja.

Selaimen omien keskustelujen Pi-kysymyksiin vastataan dialogeissa.
Terminaalista käynnistettyjen keskustelujen historiaa voi lukea.
Keskustelujen toimintarajat on kuvattu [käyttökuluissa](../docs/product.md).

## Käyttöönotto

Yhteinen kehys näyttää tuotteen, palvelimen ja vaiheet GitHub → Repot → OpenAI.
Repolistan koko rivi toimii valintana. Kaikki repot näkyvät oletuksena;
aikarajaus on käyttäjän valinta. Valitut repot säilyvät löydettävissä.
Kloonauksen eteneminen ja tulos tulevat palvelimelta. Epäselvä tulos säilyy
selvitettävänä, jotta käyttäjä ei vahingossa aloita samaa työtä uudestaan.

OpenAI-vaihe näyttää Pi:n kirjautumiskoodin, kopioinnin ja linkin
palveluntarjoajan sivulle. Koodin valmistuminen on odotustila. Käyttöönoton
keskeyttäminen on rauhallinen toissijainen toiminto, jonka vahvistus kertoo
uloskirjautumisen vaikutuksen.

## Komponentit ja vedokset

Visuaaliset komponentit saavat näyttömallin ja välittävät käyttäjän toiminnot
sovellukselle. Verkkoyhteydet ja natiivitiedon tulkinta kuuluvat sovellukselle;
[tapahtumat ja palautuminen](../docs/architecture/events-and-recovery.md) kertoo työnjaon.
Samat tuotantokomponentit muodostavat Storybookin esimerkit.

Vedokset ovat klikattavia sommittelumalleja simuloidulla tiedolla. Niiden
prototyyppilogiikkaa ei kopioida sovellukseen. Tässä kuvattu toiminta täydentää
kuvia esimerkiksi lukukohdan säilymisessä, repohaun oletuksessa ja epävarmoissa
tuloksissa. Designin toteutusta verrataan vedoksiin rinnakkain synteettisessä
labissa; poikkeamat korjataan yhteisissä komponenteissa ja tokeneissa.
Vertailun fixture näyttää designin tilat: vähintään yksi käynnissä oleva
keskustelu työkaluriveineen ja kahdella jonossa olevalla viestillä, yksi
vastattu, yksi vain luku, eikä yhtään duplikaattia. Duplikaatteja keräävä
fixture sai aiemmin jokaisen näkymän näyttämään rikkinäiseltä.
