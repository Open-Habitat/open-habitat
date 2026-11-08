---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Automatic title failed with model_invalid_response

## Description

- **Automaattinen otsikko epäonnistui mallin vastaukseen** (7.11. pilot.626): Jarin nopeasti peräkkäin luomista keskusteluista yhden automaattinen otsikointi päättyi journalissa `conversation_title outcome=failed operation=automatic reason=model_invalid_response` (19:01:48Z). Jari ei huomannut näkyvää vikaa; selvitä, mitä malli palautti ja jääkö keskustelu ilman otsikkoa tai yritetäänkö uudelleen (`internal/daemon`, `conversation_title`).

## Acceptance Criteria

- [x] Reproduced in a test; fixed; touched specs green.
