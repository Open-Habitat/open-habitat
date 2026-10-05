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

# Projektin nimeäminen omega-habitatiksi

## Tavoite ja nimen tausta

Projektin `native-agent-host` uudeksi nimeksi tulee `omega-habitat`.
Jari varasi domainin `omega-habitat.dev` 2026-09-25. Nimenvaihto kattaa
tuotteen, julkaisut, GitHub-repon ja kehitysympäristön viittaukset sekä
Fleetrepoen ulottuvat vaikutukset.

Habitat viittaa agentteihin niiden omassa ympäristössä, ”in their native
habitat”, ja säilyttää nykyisen nimen *native*-ajatuksen. Ω viittaa
ilmaukseen ”alfa ja omega”: kaikki agentit ja pääsytavat, kuten selain,
SSH ja tmux, samassa paikassa. Tämä on nimen ajatus, ei lupaus nykyisestä
agenttituesta. Kirjain on tunnettu ja löydettävä, ja sen muodosta voi
kehittää kaarta tai porttia muistuttavan logon.

Nimeä valittaessa hylättiin seuraavat vaihtoehdot:

- `lambda-*`: AWS Lambda ja Lambda Labs toimivat samalla hosting- ja
  tekoälyinfran alueella.
- `pi-*`: pi-agentti on yksi hostattavista agenteista.
- `*-nexus`: Sonatype Nexus.
- `*-hearth`: sekoittuu heart-sanaan.

`eta-habitat` jäi kakkosvaihtoehdoksi. Tunnettu sivutörmäys on Metan
`habitat-sim`, tekoälyagenttien simulaattori; omega-etuliite erottaa nimet.

Tarkistuksessa 2026-09-25 GitHubista ei löytynyt `omega-habitat`-nimistä
repoa, käyttäjää tai organisaatiota, ja `omega-habitat.ai` oli vapaana.
Nämä ovat tuon päivän havaintoja, eivät nykytilan takeita.

## Muutoksen laajuus

Issuen alkuperäisessä, 2026-09-25 kirjatussa kartoituksessa vanhan nimen
muodoille `native-agent-host`, `native agent host` ja `native_agent_host`
löytyi kirjainkoosta riippumatta noin 1050 osumaa ilman `node_modules/`, `.git/`, `history/` ja
`dist/`-hakemistoja. Luku kuvaa muutoksen silloista kokoa, ei toteutuksen
tarkkaa tiedostolistaa.

Saman nimen pitää toimia yhtenäisesti lähdekoodista asennettavaan pakettiin.
Muutokseen kuuluvat:

- **Go ja web:** `go.mod`-moduulipolku, `cmd/native-agent-host`, importit,
  `internal/`-hakemiston asennuspolut ja yksikkönimet sekä
  `web/package.json`, `web/package-lock.json` ja `web/index.html`.
- **Paketointi:** `systemd/`-yksiköt, `sysusers.d/`- ja
  `tmpfiles.d/`-määritykset ja niiden `native-agent-host.conf`-tiedostot,
  julkaisuarkistot ja `dist/` sekä niitä tuottavat tai tarkistavat
  `scripts/package-release.sh`, `verify-release.sh`, `vm-test.sh` ja
  `ci-local.sh` sekä `test/vm/`-testit.
- **Dokumentaatio ja sopimukset:** `AGENTS.md`, `docs/`, `contracts/`,
  `design-system/`, `docs/.glasspad.yaml`, `CONFORMANCE.md`, `TODO.md`,
  `DEPENDENCIES.md`, `AGENTS-WORKFLOW.md` sekä issue-tekstit ja
  `native-agent-host-architecture`-viittaukset.
- **GitHub ja kehitysympäristö:** repo
  `maintainer/native-agent-host` → `maintainer/omega-habitat`,
  paikallinen `origin`, `~/Sources/native-agent-host` ja sen
  `__worktrees`-hakemisto sekä taskfleet- ja tw-projektikonfiguraatio
  (tw:n projektimerkintä on Fleetrepossa).
- **Fleetrepo:** muun muassa `native-agent-*`-issuet sekä Hetzner- ja
  JIT-broker-töiden viittaukset yksiköihin, käyttäjiin ja polkuihin;
  myös asennettu tila kuuluu huomioitaviin vaikutuksiin.

Historialliset tutkimus- ja ADR-tekstit voivat säilyttää vanhan nimen,
kun ne kuvaavat silloista tilannetta. Toteuttaja ratkaisee säilytettävät
kohdat niiden merkityksen perusteella ja luettelee ne tässä issuessa.

`docs/.glasspad.yaml`-tiedoston `space_key` tunnistaa julkaistavan
dokumentaatiotilan: sen vaihtaminen voi vaikuttaa siihen, päivittyykö
olemassa oleva tila vai syntyykö uusi. Kyse ei siis ole vain näkyvästä
otsikosta. `docs/AGENTS.md` mainitsee myös vanhan avaimen ja kuuluu
päivitettäviin viittauksiin.

Osa nimistä on jo käytössä: `/etc/omega-habitat/daemon/user-mappings`
on daemonien sidontatiedostojen paikka, erillään gatewayn salaisesta
`/etc/native-agent-host`-hakemistosta (`docs/daemon-bindings.md`).
Näiden hakemistojen yhdistäminen suoralla nimenkorvauksella rikkoisi
käyttöoikeuksien erottelun. Uusi `/etc`-rakenne on ratkaistava erikseen.
Myös lyhenteet kuten `NAH_*` ja `nah-*` on arvioitava nimeämisen osana.

## Ajoitus ja asennettu tila

Nimenvaihto koskee laajasti samoja tiedostoja kuin muu kehitys ja muuttaa
myös työkalujen käyttämiä polkuja. Toteutus tarvitsee hiljaisen ikkunan,
jossa yhtään taskfleet-ajoa ei ole käynnissä, jotta keskeneräisten
worktreeiden työ ja niiden laskeutuminen eivät rikkoudu.

Alkuperäinen toive 2026-09-25 oli tehdä muutos ennen ensimmäistä oikean
palvelimen asennusta ja välttää siten käyttäjien ja yksiköiden migraatio.
`TODO.md`:n 2026-09-30 tilannekuva kertoo jo testipalvelinjulkaisusta
pilot.12. Fleetrepon 2026-09-29 inventaarion mukaan testipalvelimen pilot.12:n
yksiköt ja polut käyttävät vanhaa nimeä. Toteutuksessa on tarkistettava
asennettu nykytila; asentamattomuuteen ei voi enää nojata.

Jos vanha nimi on käytössä systemd-yksiköissä, käyttäjissä tai poluissa,
pelkkä tekstin vaihto ei riitä: asennus tarvitsee hallitun migraation.
Fleetrepon viittaukset ja asennettu tila voidaan päivittää tämän työn
yhteydessä tai kirjata omaksi Fleetrepo-issuekseen. Asennuksen tiedot ja
kuitit ovat Fleetrepon `infra/machines/native-agent-host-test.md`:ssä. Vaihto- ja palautusmenettely
on `infra/native-agent-host-test/RELEASE-UPGRADE.md`:ssä, mutta sen nykyinen
operaattori on vain samojen yksiköiden ja polkujen byte-only-vaihtoa varten:
nimenvaihto tarvitsee erillisen migraatio- tai uudelleenasennusmenettelyn.

## Hyväksymiskriteerit

- [ ] Go-moduuli, binääri, systemd-, sysusers- ja tmpfiles-nimet, julkaisuarkisto
      ja web-paketti käyttävät nimeä `omega-habitat`.
- [ ] Jäljellä olevat `native-agent-host`-maininnat ovat vain tietoisesti
      säilytettyä historiaa, ja ne on lueteltu tässä issuessa.
- [ ] `./scripts/ci-local.sh --clean --json` menee läpi.
- [ ] GitHub-repo on nimetty uudelleen, ja `origin` sekä paikalliset polut on
      päivitetty.
- [ ] Fleetrepon viittaukset ja mahdollinen asennettu tila on päivitetty tai
      kirjattu omaksi fleetrepo-issuekseen.

## Decisions

### 2026-09-30T17:57:12Z · @claude

Rethink-night 30.9.: rethink-instructions (gpt-6-astra), faktantarkistus fact-check-instructions (claude-opus-5-5). Säilytin Jarin nimen, domainin, hylätyt vaihtoehdot ja hyväksymiskriteerit sekä hiljaisen toteutusikkunan; historialliset havainnot päivätty, historiallisten mainintojen arvio jätetty toteuttajalle. Ilman Jaria tulkitsin omega-perustelun nimimetaforaksi enkä päättänyt logosta tai julkaistun Glasspad-tilan siirrosta. Faktantarkistus täsmensi asennetun pilot.12:n, Fleetrepon inventaarion ja byte-only-vaihto-ohjeen rajan, vanhan ja jo käytössä olevan omega-habitat-/etc-polun käyttöoikeuseron, Glasspad-tiedoston sijainnin sekä puuttuvat koodi-, testi- ja dokumenttiviittaukset. Nykyistä vieraskoneen tilaa tai domainin saatavuutta ei tarkistettu. Ei ristiriitaa Jarin kirjattujen päätösten kanssa.
