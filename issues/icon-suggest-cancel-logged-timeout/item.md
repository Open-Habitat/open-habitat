---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: icon-log
lane_seq: 1
closed: 2026-11-07
---

# Icon suggestion cancel is logged as a model timeout

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Kuvake-ehdotuksen peruminen kirjautuu aikakatkaisuna (agentti 7.11., pilot.612): kun työtilan sivulta lähtee ennen ehdotuksia, journaliin tulee `workspace_icon_suggestions outcome=failed reason=model_timeout duration_ms=2147` (ja 1720) samaan aikaan kuin pyynnön `http_request outcome=client_canceled`. Raja on 45 s, joten syy on selaimen peruutus eikä mallin hitaus; lokin pitää sanoa se, muuten aikakatkaisujen osuus näyttää todellista suuremmalta (`workspace-icon-polish`, `internal/daemon/workspace_icon_suggest_linux.go`).

## Acceptance Criteria

- [x] havainto korjattu; testi rajapinnassa
