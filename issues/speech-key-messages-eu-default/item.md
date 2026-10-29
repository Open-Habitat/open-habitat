---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
lane_seq: 5
collision: [internal/daemon/speech_linux.go]
preparation: ready
---

# Clearer speech key messages; EU first

_Source: chat_

## Description

Jari 29.10. after `speech-key-wrong-region`: the error messages must be clearer, and **EU is the default here** (Soniox region probe order EU first, then US).

## Acceptance Criteria

- [ ] Saving probes EU first, US only after a 401/403 at EU.
- [ ] Every speech key message says plainly what happened and what to do: saved and in which region (and that it was not the default when it is US); refused in both regions (the key is wrong or revoked; get a new one from the Soniox console, link); Soniox unreachable or limit reached (nothing saved, try again); a dictation that healed a wrong stored region says nothing or once, never "hylkäsi avaimen" for a working key. Review the dictation notices ("Soniox hylkäsi avaimen", "Sanelu katkesi: …") in the same pass.
- [ ] Tests updated; KOKEILTAVAA line.
