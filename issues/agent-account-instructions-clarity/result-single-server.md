# Yksi Microsoft-prosessi henkilölle

**Suosittelen yhtä Microsoft-prosessia henkilön daemonin taakse.** Kaikki
keskustelut käyttävät sitä. Viisi aihealuetta jäävät agentin hakua varten,
mutta ne eivät käynnistä viittä Microsoft-palvelinta. Pi:n ja daemonin väliin
tarvitaan pieni välitin. Tuotantoon ei ole muutettu mitään.

**Pelkkä hakukategorian lisääminen ei riitä.** Kuudessa mallikokeessa agentti
lisäsi kategoriat kaikkiin 11 hakukyselyynsä. Silti yhdessä haussa näkyi
postikansion poisto. Yksi ajoista ei käyttänyt hakua vaan suodatti työkalulistaa
itse. Kaikki kuusi yrittivät ensin tiedostotyökalua, eikä mikään yrittänyt poistoa.
Ohje siis parantaa toimintaa, mutta ei erota tiedostoja postilaatikon ylläpidosta.

**Muisti:** neljä samanaikaista keskustelua käytti yhtä noin **177 MiB:n
Microsoft-prosessia**. Kokeen välitin ja pienet yhteysprosessit mukaan lukien
Microsoft-yhteyksien osuus oli noin **477 MiB yhteensä**, ei 177 MiB. Pi:n omat
prosessit olivat tämän lisäksi noin 609 MiB. Tuotannon Go-välittimen muistia ei
ole vielä mitattu. Keskustelun sulkeminen ei sammuttanut yhteistä palvelinta.

**Ihminen näkee** samat viisi aihealuetta ja kirjautuu kerran tiliä kohti.
Suuri palvelinprosessi ei enää monistu keskustelujen mukana. Usean Microsoft-tilin tapauksessa
yksi palvelinpaikka vaihdetaan tililtä toiselle vasta edellisen työn päätyttyä:
vanha prosessi lopetetaan ennen uuden käynnistämistä. Näin henkilö ei saa toista
Microsoft-prosessia, mutta eri tilien vuorottelu voi odottaa käynnistystä.
Tämä vaihtovuoro ja sen viive pitää vielä toteuttaa ja testata; muistimittaus
koski yhtä kirjautumatonta koetiliä.

**Tietoturva:** Jarin lisärajauksen mukaisesti palveluun pääsee vain henkilön
oma Unix-käyttäjä. Suosittelen yksityistä Unix-socketia ja käyttäjätunnuksen
tarkistusta, en verkkopalvelinta. Toinen käyttäjätunnus ei päässyt kokeen
socketiin. Pi:n yksityinen putki vaihtuu palveluun, johon henkilön muutkin omat
prosessit voivat liittyä suoraan. Muille ihmisille, gatewaylle tai selaimelle
ei anneta pääsyä; sen muuttaminen vaatisi uuden päätöksen. ADR on **Proposed**
arkkitehtuurin hyväksymistä varten, eikä tutkimuksen yhdistäminen ota palvelua
käyttöön.

HTTP ei ole tässä oikotie: nykyisen kirjautumisen käyttö vaatii sen eteen
erillisen suojauksen, eikä sama tila salli nykyistä tiedoston tallennustyökalua.
Pi:n tulevia parannuksia ei odoteta.

Päätösehdotus: [ADR 0039](../../docs/decisions/adr-0039-one-microsoft-process-per-person.md).
Mittaukset, hakutaulukot ja rajaukset: [koeraportti](single-server-evidence.md).
