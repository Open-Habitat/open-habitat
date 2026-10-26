---
created: 2026-10-26
updated: 2026-10-26
type: bug
status: open
priority: normal
lane: agent-context
collision: [internal/daemon/host-context.md, internal/cli/agent_linux.go]
preparation: ready
---

# Agentti ei tiedä oman palvelimensa julkista osoitetta

## Description

Selaimen kautta toimiva Pi-agentti ei tiedä, millä osoitteella sen oma
Habitat näkyy käyttäjälle (Birchlla `https://habitat.example.test`). Kun agentin
piti ohjata käyttäjä GitHub-uudelleenkirjautumiseen (`/auth/github/start`),
se joutui kaivamaan osoitteen Fleetrepon dokumenteista. Agentti, joka ei
näe Fleetrepoa, ei olisi löytänyt osoitetta ollenkaan. Agentin pitää osata
antaa käyttäjälle toimiva linkki omaan palvelimeensa: asetussivulle,
kirjautumiseen tai näkymään.

Nyt osoitteen tietää vain gateway (`internal/gateway/auth.go`, `Origin`).
Daemonilla sitä ei ole: `open-habitat agent environment show --json` ei
kerro sitä, eikä upotettu `internal/daemon/host-context.md` voi sitä
sisältää. `/etc/open-habitat` ei ole käyttäjän luettavissa.

Ratkaisun suunta: julkinen origin (ei salaisuus) välitetään daemonille, ja
agentti saa sen `agent environment show` -tulosteeseen ja/tai Pi:n
host-kontekstiin. Daemon ei saa luottaa siihen identiteettitietona. Se on
pelkkä näytettävä osoite.

## Acceptance Criteria

- [ ] `open-habitat agent environment show --json` kertoo palvelimen julkisen originin
- [ ] Agentin host-konteksti kertoo, mistä osoitteen saa, jotta agentti osaa antaa siitä linkin

