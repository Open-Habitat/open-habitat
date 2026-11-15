---
created: 2026-11-15
updated: 2026-11-15
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/github-card-visible
lane: github-card-impl
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# GitHub card: clear texts and visible actions (round 1 direction 2)

## Description

Jari 15.11.2026 accepted direction 2 **Näkyvissä** of `proto-github-card-clarity` round 1 (`design-system/prototypes/rounds/2026-11-15-github-card/`): short texts, account and state (Toimii / Ei toimi / Ei yhdistetty), *Kirjaudu uudelleen GitHubilla* and *Katkaise yhteys…* always visible at the card's bottom, scopes on one line, workflows row shortened with the secrets warning kept; disconnect handles the fresh sign-in inside its dialog (*Vahvista GitHubilla* → back → *Katkaise yhteys*).

## Acceptance Criteria

- [x] The accepted visible card is in production without an experimental switch, including workflow and connection states.
- [x] Stale sign-in is handled inside the disconnect dialog; ordinary OAuth returns to it without automatically disconnecting or weakening either server guard.
- [x] Explain mode and the generated UI guide match the controls.
- [x] State, return-path, cancellation and browser tests pass; focused review findings are resolved and evidence limits are recorded in result.md.
