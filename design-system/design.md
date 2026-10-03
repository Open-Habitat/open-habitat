# Käyttöliittymän design

Omega Habitat on rauhallinen työväline omien työtilojen ja agenttikeskustelujen
käyttöön. Keskustelu on pääsisältö; navigaatio, tilat ja toiminnot tukevat sen
lukemista. Käyttöliittymä toimii työpöydällä ja puhelimessa, vaaleana ja tummana.

[Vedokset](drafts/) näyttävät sommittelun ja esitystilat. Yhteiset mitat, värit,
fontit ja liike ovat [tokeneissa](tokens/), joita sovellus käyttää
`styles.css`:n kautta. [Komponenttikartta](components.md) johtaa samoihin
komponentteihin, jotka näkyvät sovelluksessa ja Storybookissa.
[Käyttökulut](../docs/ui.md) kuvaavat toiminnan ja
[rajapinnat](../docs/interfaces.md) hostin tarjoaman tiedon.

## Ilme

Oletustila on hiljainen. Käynnissä oleva työ, vastausta odottava kysymys,
vain luku -tila, katkos ja epävarma tulos saavat tunnistettavan esityksen.
Tila näkyy merkin, sanan ja värin avulla; onnistuneesta lähetyksestä tai
tyhjästä jonosta ei synny pysyvää ilmoitusta. Vain luku -tila on ontto rengas
tai katkoviivareuna, ei lause. Rehellisyysvaatimukset (ei keksittyä tilaa, ei
automaattista uudelleenlähetystä, epävarma lähetys näkyvissä) täytetään
designin omilla elementeillä, kuten katkoviivakuplalla ja ontolla renkaalla,
ei lisätyllä selittävällä tekstillä. Kun hostilla ei ole faktaa, elementti
jätetään pois sen sijaan, että sen puute selitettäisiin. Painikkeissa ei ole
ohjetekstiä.

Näkymässä on yksi ensisijainen toiminto kerrallaan. Toissijaiset toiminnot
ovat hillittyjä. Reunat erottavat pinnat, varjot kuuluvat kelluviin valikoihin,
laatikoihin ja viimeisimpään vievään painikkeeseen. Estetty toiminto säilyy
luettavana. Pikanäppäinten ohje kuuluu omaan vihjeriviinsä.

Käyttöliittymä on suomeksi. Instrument Sans on ihmisen tekstille, JetBrains
Mono poluille, komennoille, repoille ja muille koneellisille tunnisteille.
Tunnisteet säilyvät siinä muodossa, jossa käyttäjä kohtaa ne terminaalissa.
Fontit tulevat tuotteen mukana. Ikonit käyttävät yhteistä ikonikomponenttia,
jotta niiden ulkonäkö ei riipu käyttöjärjestelmän fontista.

Järjestelmäteema on oletus; käyttäjä voi valita myös vaalean tai tumman teeman.
Vähennetyn liikkeen asetus poistaa pulssit ja siirtymät. Pitkä teksti ja zoomaus
saavat kasvattaa sisältöä peittämättä toimintoja.

## Sovelluskehys

Sivupalkin Etusivu vie paluunäkymään, jossa käyttäjä jatkaa keskustelujaan.
Työtilat ryhmittelevät keskustelut. Sivupalkin voi sulkea kapeaksi kaistaksi,
jossa keskeiset toiminnot säilyvät saatavilla. Puhelimessa navigaatio avautuu
valikkolaatikkoon keskustelun päälle.

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

Hylätty lähetys säilyttää tekstin korjausta varten. Epävarma lähetys näkyy
viestin yhteydessä ja tarjoaa tekstin talteen; sitä ei lähetetä automaattisesti
uudestaan. Sovelluksen yhteyskatkos näkyy yhdessä yläreunan ilmoituksessa.
Taustapäivitys ei siirrä fokusta eikä korvaa luettavaa näkymää latausruudulla.

Designer suunnittelee jokaisen keskustelulohkon esitystilat. Agentti kartoittaa
lohkojen merkitykset ja toimittaa esimerkit, sitten toteuttaa ne yhteisiin
komponentteihin ja katalogiin. Käyttäjälle tarkoitettu sisältö säilyy;
salattua thinking-dataa tai teknisiä payloadeja ei esitetä viesteinä.
Tuntematon sisältö saa hillityn esityksen. Historia ja reaaliaikainen näkymä
käyttävät samoja tulkintoja.

Selaimen omien keskustelujen Pi-kysymyksiin vastataan dialogeissa.
Terminaalista käynnistettyjen keskustelujen historiaa voi lukea.
Keskustelujen toimintarajat on kuvattu [käyttökuluissa](../docs/ui.md).

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
[tilan omistajuus](../docs/conversation-data-flow.md) kertoo työnjaon.
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
