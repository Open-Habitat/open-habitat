---
created: 2026-10-24
updated: 2026-10-24
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: unlaned
---

# Editor: 'keep my text' after a concurrent agent save silently drops the agent's changes

## Description

Found in `proto-concurrent-file-edit` round 1 (result.md, "Suunta 0 · Nykyinen tuotanto"): after an agent saved a file the person has unsaved changes in, the editor's action "Käytä luettua versiota pohjana, säilytä oma teksti" only accepts the disk version as the base and keeps the person's buffer; the next Save then writes the person's text over the file and **the agent's changes disappear from the file without any mention**. The label promises keeping, the result is overwriting.

Interim fix until Jari picks the conflict design: the action must say what it does (the agent's / disk changes will be replaced) and Save after it must confirm with that consequence spelled out; nothing else changes. The full design follows the prototype decision.

## Acceptance Criteria

- [ ] The action and the following Save state that the disk version will be replaced and require explicit confirmation; browser test proving the agent's version is not replaced without that confirmation.
