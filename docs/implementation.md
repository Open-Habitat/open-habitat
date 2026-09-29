# Toteutuksen työnjako

Käyttäjä kirjautuu selaimella omalle Unix-tililleen, avaa työtilan ja Pi:n
historian sekä työskentelee agentin kanssa. Toteutus etenee toimivista
käyttökuluista havaintoihin ja rajattuihin korjauksiin.

[Toteutuskartta](../issues/plan-v1-implementation/implementation-briefs.md)
osoittaa kunkin toiminnon vastuullisen issuen. Issuet sisältävät toteutuksen
rajauksen ja testit; issuectl määrää riippuvuudet ja työjärjestyksen.

## Toiminnot

Ensimmäinen käyttökulku yhdistää kirjautumisen, työtilan, natiivihistorian ja
Pi:n ohjauksen. Selain näyttää vastauksen ja työkalujen etenemisen SSE:n kautta.
Selaimen sulkeminen ei pysäytä agenttia. Päättynyttä selainkeskustelua voi jatkaa
sen natiivihistoriasta; epävarmaa lähetystä ei uusita automaattisesti.
Terminaalikeskustelut ovat selaimessa vain luettavia.

Keskustelun työkaluryhmät, koodi, diffit, otsikot ja jono täydentyvät omassa
issuessaan. Pi:n erilliset kysymysdialogit eivät kuulu nykyiseen toteutukseen.
Työtilojen elinkaari, GitHub, Taskfleet-worktreet sekä arkistointi ja jatkaminen
säilyvät toteutettavina toimintoina.

## Vastuut

[Arkkitehtuuri](architecture.md) erottaa todennuksen gatewaylle, käyttäjän työn
hänen daemonilleen ja ensikirjautumisen tilinluonnin root-brokerille.
[ADR 0004](adr-0004-first-login-user-provisioning.md) kuvaa tilinluonnin.
Unix-käyttäjät ja tiedosto-oikeudet erottavat ihmiset toisistaan.

[Rajapinnat](interfaces.md) määrittelevät viestit ja niiden merkityksen.
Puskurilla tai rajalla pitää olla konkreettinen tarve. Toteuttaja valitsee
yksinkertaisen ratkaisun ja säätää arvoja mittausten ja havaintojen perusteella:
tavallinen keskustelu tai historian lukeminen ei saa törmätä mielivaltaiseen
rajaan. Pi säilyttää historian ja ajaa työkalut.

## Todentaminen ja katselmointi

[Paikallinen puhdas CI-portti](../scripts/AGENTS.md) on yhteinen tarkistus.
GitHub Actions on poistettu käytöstä. Ominaisuuden issue kertoo lisäksi,
miten sen selain-, Pi- ja eristyskäyttäytyminen todennetaan. Synteettinen testi,
erillisten UID:iden vierastesti ja oikean palvelimen koe todistavat eri asioita.

Käyttöliittymämuutoksista jätetään tarkoituksenmukaiset kuvakaappaukset ja
testinäyttö. Jarin visuaalinen arvio kirjataan, kun hän antaa sen; odottava
kuva-arvio ei estä toiminnallisen työn valmistumista tai riippumatonta työtä.
Yhtä lopullista MVP-hyväksyntäporttia ei ole.

## Julkaisu ja asennus

Tuoterepo omistaa siirrettävän julkaisupaketin, neutraalit palvelumallit ja
yleiset itseylläpidon ohjeet. Fleetrepo omistaa testipalvelimen konkreettisen
asennuksen, salaisuudet, käyttäjät, verkkoreitin ja käyttöönottokuitit.

Testijulkaisut asennetaan Fleetrepon ajantasaisen
`infra/native-agent-host-test/RELEASE-UPGRADE.md`-menettelyn mukaan. Sen
esitarkistuksen ja paluupolun pitää olla kunnossa. Oikeat ihmiset osallistuvat
itse kirjautumiseensa; tekniset kahden UID:n eristystestit käyttävät synteettisiä
tunnuksia. Tuotantopalvelimen perustaminen on Jarin erillinen päätös.
