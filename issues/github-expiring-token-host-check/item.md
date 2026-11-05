---
created: 2026-11-05
updated: 2026-11-05
type: feature
reporter: jari
status: open
priority: high
preparation: ready
provenance: chat
source_ref: chat:2026-11-05/github-expiring-host-check
lane: github-expiring-check
lane_seq: 1
---

# host check warns when the GitHub OAuth app issues expiring tokens

## Description

Jari 5.11.2026: toteutetaan. Northwindin GitHub OAuth -sovellus antoi
vanhenevia (8 h) tunnuksia, joten Villen GitHub-yhteys katkesi päivittäin
3.–4.11. Gateway kirjasi joka kirjautumisessa `github_token_expiring`
(WARN, `reason: oauth_app_expiring_tokens`, `expires_in_s: 28800`, viisi
kertaa 3.–4.11.), mutta varoitus jäi journaliin eikä kukaan nähnyt sitä.
Sama vika oli Birchlla 27.10. (`github-token-expires-daily`). Jari teki
Northwindin sovellukseen opt-outin 5.11.

Tehdään väärin asetettu OAuth-sovellus operaattorille näkyväksi ilman
käyttäjän toimia: `open-habitat host check` (ja sen `--json`) kertoo, kun
gateway on viimeksi saanut GitHubilta vanhenevan tunnuksen, ja nimeää
korjauksen (OAuth App › Optional features › opt out of expiring user
tokens, sitten yhteyden uusiminen vasta vanhan tunnuksen vanhennuttua).
Tieto tulee siitä, mitä gateway itse havaitsi koodinvaihdossa; ei refresh-
tunnusta, ei tunnusvälittäjää (root AGENTS.md). Tunnuksia ei kirjata eikä
tulosteta. Havainnon on vanhettava, kun opt-outin jälkeen tulee
vanhenematon tunnus.

Käyttöliittymän ilmoitus ylläpitäjälle ei kuulu tähän; se prototypoidaan
erikseen, jos Jari sitä haluaa.

## Acceptance Criteria

- [ ] host check varoittaa vanhenevia tunnuksia antavasta OAuth-sovelluksesta ja kertoo korjauksen; varoitus poistuu, kun seuraava kirjautuminen saa vanhenemattoman tunnuksen
- [ ] testi rajapinnassa (synteettinen GitHub, kuten `TestExpiringTokenSignInWarns`); tunnukset eivät päädy lokiin, tilaan eikä tulosteeseen
- [ ] docs/operations.md mainitsee tarkistuksen
