---
created: 2026-09-25
updated: 2026-09-25
type: chore
status: open
priority: normal
lane: rename
collision: [docs/, AGENTS.md, design-system/, scripts/vm-test.sh]
---

# Rename project to omega-habitat

## Tavoite

Nimetään projekti `native-agent-host` → **`omega-habitat`**. Jari on varannut
domainin `omega-habitat.dev` (2026-09-25).

## Nimen perustelu

- **Sanaleikki:** agentit ajetaan käyttäjän omassa ympäristössä, "in their native
  habitat". Uusi nimi säilyttää nykyisen nimen ytimen, *native*.
- **Ω omega**: "alfa ja omega", eli kaikki agentit ja kaikki pääsytavat (selain,
  SSH, tmux) samassa paikassa. Kirjain on tunnettu ja löydettävä, ja siitä
  saa logon, joka muistuttaa kaarta tai porttia.
- Tarkistettu 2026-09-25: GitHubissa ei ole yhtään `omega-habitat`-nimistä repoa
  eikä samannimistä käyttäjä- tai organisaatiotiliä. `omega-habitat.ai` oli vielä
  vapaana.
- Hylätyt vaihtoehdot:
  - `lambda-*`: AWS Lambda ja Lambda Labs ovat samaa hosting- ja tekoälyinfraa.
  - `pi-*`: pi-agentti on yksi hostattavista agenteista.
  - `*-nexus`: Sonatype Nexus.
  - `*-hearth`: sekoittuu heart-sanaan.
  - `eta-habitat` oli kakkosvaihtoehto.
- Tunnettu sivutörmäys: Metan `habitat-sim` (tekoälyagenttien simulaattori).
  Omega-etuliite erottaa nimet.

## Laajuus

Nykyinen nimi esiintyy noin 1050 kertaa (`grep -i "native-agent-host\|native agent
host\|native_agent_host"`, ilman node_modules/.git/history/dist-hakemistoja):

- **Go:** moduulipolku `go.mod`, binääri `cmd/native-agent-host`, importit.
- **Paketointi:** `systemd/`-yksiköt `native-agent-host-{gateway,broker,daemon@}.*`,
  `sysusers.d/`, `tmpfiles.d/` ja `native-agent-host.conf`, sekä
  `scripts/package-release.sh`, `verify-release.sh`, `vm-test.sh` ja
  `ci-local.sh`, julkaisuarkistojen nimet ja `dist/`.
- **Web:** `web/package.json`, `package-lock.json` ja `index.html`.
- **Dokumentaatio:** `AGENTS.md`, `docs/`, `contracts/`, `design-system/`,
  `.glasspad.yaml`, `CONFORMANCE.md`, `TODO.md`.
- **Issuet:** issue-tekstit ja `native-agent-host-architecture`-viittaukset.
  Historialliset tutkimus- ja ADR-tekstit voi jättää ennalleen, jos ne
  kuvaavat silloista nimeä. Päätös tehdään toteutuksessa.
- **GitHub-repo:** `maintainer/native-agent-host` → `maintainer/omega-habitat`
  (`gh repo rename`), ja paikallisen `origin`-osoitteen päivitys.
- **Fleetrepo:** `native-agent-*`-issuet sekä Hetzner- ja JIT-broker-työt
  viittaavat yksiköiden, käyttäjien ja polkujen nimiin. Jos nimi on jo asennettu
  koneille (systemd-yksiköt, sysusers, polut), tarvitaan hallittu
  migraatio, ei pelkkä tekstin vaihto.
- **Paikalliset polut:** `~/Sources/native-agent-host` ja `__worktrees`,
  taskfleet- ja tw-projektikonfiguraatio.

## Ajoitus

Nimenvaihto koskee lähes jokaista tiedostoa ja törmää kaikkiin keskeneräisiin
worktreeihin. Aja se hiljaisessa ikkunassa, kun yhtään taskfleet-ajoa ei ole
käynnissä. Mieluiten ennen kuin paketti asennetaan ensimmäistä kertaa oikealle
palvelimelle, jolloin yksiköiden ja käyttäjien migraatio jää kokonaan pois.

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
