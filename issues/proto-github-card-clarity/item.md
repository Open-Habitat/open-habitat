---
created: 2026-11-15
updated: 2026-11-16
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/github-card
lane: github-card-proto
lane_seq: 1
preparation: pending
closed: 2026-11-16
---

# GitHub card in Settings is confusing; prototype again

## Description

Jari 15.11.2026 (test server, Settings › Code hosts, GitHub card, Yö theme): the card is "tolkuttoman sekava" and must be prototyped again. The text is partly unnecessary ("Kirjautunut käyttäjänä … Git ja gh toimivat työtiloissa. Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta.", scopes as chips, a long sentence about what disconnect removes), and he does not understand what the "Tarkista katkaisu" button even does. Next to it the "Yhdistä GitHub uudelleen" button and the GitHub Actions workflows row ("Ei sallittu", "Salli GitHubissa").

## Decisions

### 2026-11-15T18:52:51Z · @jari

Jari 15.11.2026: direction 2 Näkyvissä (short texts; Kirjaudu uudelleen and Katkaise yhteys… always visible at the card's bottom; scopes on one line). Implementation: github-card-visible.
