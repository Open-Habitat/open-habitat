# Toteutuksen työnjako

Käyttäjän pitää päästä kirjautumisesta omaan työtilaan ja keskusteluun agentin
kanssa. Tämä käyttökulku yhdistää selaimen, gatewayn, käyttäjädaemonin ja Pi:n:
yksittäisen näkymän valmistuminen ei vielä osoita, että ne toimivat yhdessä.

Alla kuvataan sovitun toteutuksen osien yhteys. Toimintojen nykytila löytyy
[tilannesivulta](status.md) ja tarkempi työnjako
[toteutuskartasta](../issues/plan-v1-implementation/implementation-briefs.md).
Issuectl määrää ajantasaiset riippuvuudet ja työjärjestyksen.

## Yhteisestä perustasta keskusteluun

Kirjautuminen yhdistää selaimen oikeaan Unix-käyttäjään. Gateway todentaa
käyttäjän, root-broker luo tilin ensimmäisellä sallitulla kirjautumisella ja
käyttäjän daemon lukee tämän työtilat ja natiivihistoriat.
[Arkkitehtuuri](architecture.md) perustelee vastuurajat. Käyttäjien eristys
kuuluu tähän perustaan, koska kaikki myöhemmät toiminnot käyttävät samaa reittiä.

Historian lukeminen ja agentin ohjaus tarvitsevat eri asioita. Historianäkymä
lukee Pi:n tallentaman keskustelun käynnistämättä kirjoittajaa.
[Agenttiohjaus](../issues/build-agent-control/item.md) lisää uuden keskustelun,
viestin lähettämisen, työn seuraamisen ja keskeyttämisen sekä päättyneen
selainkeskustelun jatkamisen. Pi säilyttää historian ja ajaa työkalut.
Terminaalikeskustelut ovat selaimessa vain luettavia.

Ohjauksen tavoite sisältää SSE-tapahtumavirran ja paluun katkon jälkeen
ajantasaiseen keskusteluun. Selaimen sulkeminen jättää Pi:n käyntiin, eikä
vastaukseltaan epävarmaa lähetystä uusita automaattisesti.
[Rajapinnat](interfaces.md) erottavat nykyiset reitit sovitusta tulevasta
käyttäytymisestä.

[Keskustelun käyttöliittymä](../issues/complete-conversation-ui/item.md)
rakentaa ohjauksen päälle työkaluryhmät, koodin ja diffien esityksen, otsikot
sekä jonotus- ja ohjaustoiminnot. Sovellus ja Storybook käyttävät samoja
tuotantokomponentteja, jotta katselmoitavat esimerkit vastaavat käytettävää
sovellusta. Saapuvat kysymykset ja tuntematon sisältö näytetään vähintään
turvallisena tekstinä; Pi:n kysymysdialogien erilliset vastaus- ja
perumisohjaimet jäävät nykyisen rajauksen ulkopuolelle.

## Työtilat ja keskustelujen elinkaari

Työtilojen luonti, asetukset ja poisto sekä GitHub-repojen käsittely käyttävät
samaa käyttäjäkohtaista daemonia ja natiiveja tiedostoja. Taskfleet vastaa
omien worktreidensä luomisesta ja purkamisesta. Näiden toimintojen tarkemmat
rajaukset ja vastuuissuet löytyvät [toteutuskartasta](../issues/plan-v1-implementation/implementation-briefs.md#product-work).

Keskustelun arkistointi piilottaa sen säilyttäen Pi-historian. Jatkaminen
puolestaan tarvitsee agenttiohjauksen, joka varmistaa aiemman kirjoittajan
päättyneen. Siksi luettavissa oleva historia tai arkistomerkintä ei yksin
merkitse, että keskustelua voi jo jatkaa.

## Todentaminen ja katselmointi

Jokainen toiminto tarvitsee näyttöä koko käyttökulustaan ja olennaisista
virhetilanteista. [TESTING.md](../TESTING.md) kertoo, mitkä tarkistukset muutos
vaatii ja mitä niiden tuloksista voi päätellä. Selainkäyttäytyminen,
todellinen Pi ja Linux-käyttäjien eristys tarvitsevat kukin niihin sopivan
kokeen. Toteuttava issue säilyttää tulokset ja niiden rajat.

Käyttöliittymämuutoksista jätetään tarkoituksenmukaiset kuvakaappaukset ja
testinäyttö. Jarin visuaalinen arvio kirjataan, kun hän antaa sen; odottava
kuva-arvio ei estä toiminnallisen työn valmistumista tai riippumatonta työtä.
Tuotetta viedään eteenpäin havaintojen ja rajattujen korjausten kautta ilman
yhtä lopullista MVP-hyväksyntäporttia.

## Julkaisu ja asennus

Tuoterepo omistaa siirrettävän julkaisupaketin, neutraalit palvelumallit ja
yleiset itseylläpidon ohjeet. Fleetrepo omistaa testipalvelimen konkreettisen
asennuksen, salaisuudet, käyttäjät, verkkoreitin ja käyttöönottokuitit.
[Asennuksen ja palautumisen työ](../issues/prepare-mvp-operations/item.md)
yhdistää julkaisun käyttäjien natiivien tietojen säilymiseen päivityksissä ja
palautuksissa.

Testijulkaisut asennetaan Fleetrepon ajantasaisen
`infra/native-agent-host-test/RELEASE-UPGRADE.md`-menettelyn mukaan. Sen
esitarkistuksen ja paluupolun pitää olla kunnossa. Oikeat ihmiset osallistuvat
itse kirjautumiseensa; tekniset kahden UID:n eristystestit käyttävät synteettisiä
tunnuksia. Tuotantopalvelimen perustaminen on Jarin erillinen päätös.

### Kloonauksen levyliitos

Julkaisun asennus-/päivitysvaiheessa ylläpitäjä tekee **jokaiselle** mapatulle
Linux-käyttäjälle oman, korkeintaan 20 GiB:n kokoisen kovasti rajatun
levytaltion ja liittää sen ennen käyttäjädaemonin käynnistystä polkuun
`<käyttäjän HOME>/src`. Taltion juuren omistaja on kyseinen UID, hakemiston
oikeudet 0700 (ei ryhmän tai muiden kirjoitusoikeutta). Taltiot eivät saa
jakaa samaa kapasiteettia rajattomalla yhteisellä tiedostojärjestelmällä:
yksi UID ei saa voida kuluttaa toisen taltion kiintiötä. Levyn koon pitää
olla käyttöjärjestelmän enforceeraama (esimerkiksi oma rajattu levypohjainen lohkolaite tai LV), ei vain sovelluksen
laskuri eikä `statfs`-ennuste. Usean gigatavun klooneja ei sijoiteta
muistipohjaiselle tmpfs-liitokselle.
Asennus huolehtii liitoksen pysyvyydestä ja käynnistysjärjestyksestä myös
uudelleenkäynnistyksessä. Älä peitä olemassa olevia `~/src`-puita liitoksella:
siirto tai tutkiminen on erillinen ylläpitotoimi, ei daemonin tehtävä.

Daemon avaa `~/src`:n ilman symlinkkien seuraamista, tarkistaa että sen
mount ID ja laitteen tunnus eroavat kodin vastaavista (pelkkä kodin bind mount ei kelpaa), että `statfs`-kokonaiskoko on enintään
20 GiB ja että vapaata tilaa on vähintään 5 GiB ennen uutta virtaa. Jos
liitos puuttuu, on liian suuri, on täynnä tai sen omistajuus/oikeudet eivät
kelpaa, uusi klooni hylätään **ennen kohdehakemiston luontia**. Tämä ei
vahvista jo olemassa olevaa osittaista kloonia eikä anna lupaa yrittää
uudelleen automaattisesti. Ylläpitäjä testaa liitoksen ja ENOSPC-tilanteen
synteettisellä tilillä ennen live-käyttöä. Sovellusrepo ei muuta Fleetrepon
asennusta; päivitystyöntekijä lisää liitokset siellä ja tarkistaa
julkaisun vastaanottotositteesta niiden todellisen tilan.
