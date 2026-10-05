---
created: 2026-09-25
updated: 2026-10-05
type: chore
status: open
priority: normal
lane: rename
collision: [docs/, AGENTS.md, design-system/, scripts/vm-test.sh]
preparation: pending
---

# Name the project Open Habitat

## Tavoite

Projektin tuotenimeksi tulee **Open Habitat** ja tekniseksi nimeksi
`open-habitat`. Sama nimi kulkee selaimesta lähdekoodiin, julkaistavaan
pakettiin ja kehitysympäristöön. Habitat viittaa agentteihin niiden omassa
ympäristössä (”in their native habitat”); Open kuvaa avoimuutta eikä lupaa
nykyversioon tukea kaikille agenteille tai pääsytavoille.

## Muutoksen ulottuvuus

Nimenvaihto kattaa Go-moduulin ja importit, binäärin, web-paketin,
systemd-, sysusers- ja tmpfiles-määritykset, asennuspolut sekä niitä tuottavat
ja tarkistavat julkaisu- ja testityökalut. Nykyistä tuotetta kuvaavat
sopimukset, dokumentaatio, design-aineisto ja agenttiohjeet seuraavat nimeä.
Kartoituksessa myös `omega-habitat`, `NAH_*`, `nah-*` ja
`native-agent-host-architecture` ovat olennaisia lähtönimiä.

GitHub-repo vaihtuu muodosta `maintainer/native-agent-host` muotoon
`Open-Habitat/open-habitat`. Sitä seuraavat `origin`, paikallinen
`~/Sources/native-agent-host`, sen `__worktrees`-hakemisto sekä taskfleet-
ja tw-projektiviittaukset. Fleetrepo omistaa tw:n projektimerkinnän ja
konkreettisen testiasennuksen; niiden viittaukset kuuluvat muutokseen joko
tässä työssä tai nimetyssä Fleetrepo-jatkoissuessa.

Historiallinen tutkimus, ADR tai issuen tulos saa käyttää aikansa nimeä.
Olennaista on erottaa historia nykyisestä käyttöohjeesta. Tulokseen kirjataan
säilytettyjen vanhojen nimien kohteet ja perusteet niin, että seuraava lukija
ymmärtää, mitkä osumat ovat tarkoituksellisia.

## Mitä nimeämisessä on suojattava

Nimenvaihto muuttaa useimpien työalueiden tiedostoja ja työkalujen käyttämiä
polkuja. Sille tarvitaan tämän projektin taskfleet-ajoista vapaa ikkuna,
jotta keskeneräisten worktreeiden työ ja niiden laskeutuminen säilyvät.
Myös säilötyt työpuut voivat sisältää ainoan kopion keskeneräisestä työstä.

Daemonien sidontatiedostot ovat nyt polussa
`/etc/omega-habitat/daemon/user-mappings`, erillään gatewayn salaisesta
`/etc/native-agent-host`-hakemistosta. Molempien korvaaminen samalla uudella
nimellä ei sellaisenaan säilytä käyttöoikeuksien erottelua. Uusien polkujen
tulee säilyttää nykyiset lukuoikeudet ja Unix-käyttäjien välinen turvaraja;
nimenvaihto ei muuta komponenttien auktoriteettia.

`docs/.glasspad.yaml`-tiedoston `space_key` on julkaistun dokumentaatiotilan
identiteetti, ei näkyvä tuotenimi. Sen vaihto voi luoda uuden tilan sen
sijaan, että päivittäisi nykyistä. Tilan jatkuvuus ja olemassa olevat linkit
kuuluvat siksi nimeämisratkaisuun; julkaisemisen tausta on `docs/AGENTS.md`:ssä.

Testipalvelin on jo asennettu. Ajantasainen tila ja kuitit ovat Fleetrepon
`infra/machines/native-agent-host-test.md`:ssä, ja asennustavan valintaa
kuvaa `infra/native-agent-host-test/RELEASE-UPGRADE.md`. Nykyinen saman
asennusrakenteen julkaisuvaihto ei yksin ratkaise yksiköiden, käyttäjien ja
polkujen nimeämistä. Testikoneen data ja vanhat versiot ovat korvattavissa,
joten puhdas asennus on mahdollinen ilman yhteensopivuus- tai
palautusmekanismin rakentamista. Fleetrepon jaettu tunnelireitti ja muut
palvelut eivät ole hävitettävää testitilaa.

## Valmis tulos

Tuote, julkaisu ja kehitysympäristö käyttävät uutta nimeä johdonmukaisesti,
GitHub-repo ja paikalliset viittaukset on vaihdettu, ja vanhat nimet ovat
perusteltua historiaa tai dokumentoituja ulkoisia identiteettejä.
Fleetrepo-osuus on toteutettu tai sillä on nimetty jatkoissue, josta jäljellä
oleva työ selviää. Nimenvaihdon toimivuus osoitetaan `TESTING.md`:n mukaisella
puhtaalla täydellä gatella (`./scripts/ci-local.sh --clean --json`);
asennuksesta esitetään erikseen tehtyjen tarkistusten näyttö ja rajat.

## Decisions

### Jari: uusi nimi

Open Habitat (`open-habitat`) korvaa aiemman Omega Habitat -päätöksen.
Aiemmin varattu `omega-habitat.dev` ei ole uuden nimen domain; verkkotunnus
ja julkiset osoitteet ratkaistaan ennen käyttöönottoa. Aiempi GitHub-nimihaku
ei ollut nimen varaus eikä tavaramerkkiselvitys.
