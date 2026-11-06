---
created: 2026-11-04
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: high
lane: ai-sign-in-proto
lane_seq: 1
preparation: pending
---

# Prototype: telling the person their AI sign-in has expired

## Description

Jari 4.11.: when the AI provider's sign-in (Claude subscription, OpenAI,
an API key) has expired or been refused, Habitat showed the raw provider
error as an answer, and he had to find Settings › Tekoäly himself. Prototype
what the person sees instead: in the conversation where the send failed (the
failed turn, the message kept for resending), above the composer, and
app-wide (other conversations using the same provider, the rail), with one
action that signs in again (`/settings/ai` flow, or in place) and returns to
the conversation and resends or offers to resend. Cover: expired OAuth that
cannot refresh, a revoked API key, a provider outage (not a sign-in
problem: say so differently), and the phone. The GitHub expired-login
warning (`github-connection-warning`) is today's analogue to stay
consistent with. Today first (the screenshot's state), then three
directions on the default view, one line each at the top.

## Decision (Jari 2026-11-06)

Suunta **B Kenttä** on oikea. Viesti odottaa kentässä ja lähtee
käytännössä heti, kun agentti on taas linjoilla (kirjautuminen
korjattu). Kysymys (c), näkyykö epäonnistunut vuoro lyhyenä rivinä vai koko
selityksenä raaka virhe avattavissa, riffataan, jos se on yhä relevantti.
Kysymykseen (a), asetussivu vai ikkuna keskustelun päällä, Jari ei
vastannut; näytä se riffissä visuaalisesti.

## Acceptance Criteria

- [ ] A prototype round with today and three directions, desktop and phone, a recommendation and at most three questions Jari can answer by pointing at a picture.
