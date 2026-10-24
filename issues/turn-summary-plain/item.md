---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/AgentTurn]
---

# Agent turn: summary shows counts and elapsed time, no command; reply header without model name

## Description

Jari, 2026-10-24 (test server, screenshot): the collapsed activity line of an agent turn reads `2 ajatusta · 2 työkalua · git diff README.md; cat -A README.md | tail -4`. "Tässä tämä `git diff README.md ...` jne on tarpeetonta detaljia normikäyttäjälle. Sen sijaan tässä esim olisi hyvä lukea vaan 2 ajatusta · 2 työkalua · [käytetty aika]." The reply header shows `Vastaus valmis claude-opus-5-5`: "tossa vastauksessa ei tartte lukea mallin nimeä. Mallin nimi on lausuttu toisaalla."

Goal: the collapsed summary is counts plus the turn's elapsed time (e.g. `2 ajatusta · 2 työkalua · 14 s`, Finnish duration formatting such as `1 min 05 s`); the commands stay visible when the line is expanded. The reply header drops the model name. If elapsed time cannot be derived from native history timestamps for a turn, omit that part rather than guess; record the source of the time under "Decisions for later review" in result.md.

Code: `web/src/components/AgentTurn.tsx` (summary, `modelLabel`), `WorkingProgress.tsx`, `HomeWorkspaces.tsx` if it shares the wording; stories and tests.

## Acceptance Criteria

- [ ] Collapsed summary shows counts and elapsed time, no command text; expanded view unchanged (tests, story).
- [ ] Reply header without model name (test).
- [ ] KOKEILTAVAA.md line.
