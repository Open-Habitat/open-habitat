---
created: 2026-09-25
updated: 2026-10-17
type: chore
status: done
priority: normal
lane: rename
collision: [docs/, AGENTS.md, design-system/, scripts/vm-test.sh]
preparation: ready
closed: 2026-10-17
closed_by: jari
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

### 2026-10-05T14:54:15Z · @jari

2026-10-05: Jari approves the agreed Open Habitat rename as an end-of-night stretch task, only after the other selected night work has landed or settled and the repository and affected Fleetrepo Taskfleet worktrees are no longer active. This is not a request to run the rename now or to abandon unfinished branches. Check the live DAG, preserved work and external references before the broad rename. The public domain/URL remains undecided; do not invent one or rename the existing published documentation space without a continuity decision. If a human decision or live run still blocks safe completion, report the remaining work rather than claiming the rename done.

## Acceptance Criteria

- [x] Product and release rename validated by the clean full gate recorded in result.md.
- [x] GitHub origin, local checkout, tw project and Fleetrepo watcher use open-habitat; fleet verification and retained historical names are documented in result.md.
