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
