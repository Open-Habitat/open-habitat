---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/, internal/daemon]
preparation: ready
---

# Resume a stopped conversation lazily on send; no read-only state

Jari, 2026-10-16: releases restart the daemon, which ends a conversation's Pi process, so the conversation falls into "Vain luku · Jatka keskustelua". Of the two options he chose the simple one, with some slack: "Ei sitä prosessia käynnistetä heti, kun se aukeaa, vaan se käynnistetään, jos käyttäjä lähettää siihen viestin." (In short: do not start the process when the conversation opens; start it when the user sends a message.) Keeping Pi alive across daemon restarts was rejected as too complicated.

So: a conversation without a running Pi opens as its readable native history, with the composer enabled and no "Vain luku" bar and no "Jatka keskustelua" button. Sending a message starts (resumes) the native Pi session and delivers that message, visibly queued while Pi starts, never lost and never sent twice. Opening, reading, scrolling, or a reconnect never starts Pi.

## Acceptance Criteria
- [ ] After a daemon restart, an open conversation shows no read-only state; the first send resumes Pi and delivers exactly once. Host-backed browser test across a real restart.
- [ ] Opening a stopped conversation does not start Pi (test).
- [ ] Coordinated with `composer-and-new-conversation` (the field is enabled while creating).
