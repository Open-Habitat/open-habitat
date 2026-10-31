---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: open
priority: normal
lane: claude-workers
lane_seq: 3
preparation: ready
---

# Agent PATH names a payloads directory the test server's release does not have

## Description

## Description

Agentin havainto 30.10. (testikone pilot.535): `command -v claude` on `/usr/local/bin/claude` → `/opt/open-habitat/tools/claude-code-runtime/claude` (2.1.301), ja agentin PATHissa on `/opt/open-habitat/current/payloads/core/runtime/…`, jota ei ole: `/opt/open-habitat/current` → `releases/f0583be8…` sisältää vain `bin licenses open-habitat operator site systemd …`, ei `payloads`-hakemistoa. `claude-not-on-agent-path`-korjauksen lupaama polku ei siis päde testikoneella, ja Claude löytyy vain Fleetrepon asentaman `/usr/local/bin`-linkin kautta. Birchlla (`host upgrade`, generaatiot) polku voi olla eri.

## Acceptance Criteria

- [ ] Selvitetty, mistä julkaisun Claude Code löytyy kummallakin asennustavalla (testikoneen julkaisuvahti, `host apply/upgrade`-generaatio), ja agentin PATH osoittaa olemassa olevaan hakemistoon molemmissa.
- [ ] Jos testikoneen asennus on poikkeava, korjaus tai issue Fleetrepoen; olematon PATH-merkintä ei jää.
