---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: fixed
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-16
---

# Claude sign-in not findable in settings

Jari 2026-10-16: "Claude-kirjautuminen: en löydä tähän painikkeita. Pitäisi varmaan olla asetuksissa." (In short: he cannot find the buttons for the Claude sign-in; they should probably be in the settings.) KOKEILTAVAA says "Asetukset → Agentit → Pi → Kirjaudu Claudeen", but he could not find it. Check what the live settings show (pilot after adb5d106), and why the sign-in is missing or hidden: a feature flag, a missing runtime fact, or a section that is not reachable in the Osiot navigation. Make it findable where the accepted settings put agent sign-ins.

## Acceptance Criteria
- [ ] In the live build, Asetukset shows the Claude sign-in for the mapped user; lab screenshot matching the settings round; browser test.
- [x] KOKEILTAVAA's path matches the UI.
