---
created: 2026-10-16
updated: 2026-10-17
type: improvement
reporter: jari
status: done
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 10
closed: 2026-10-17
---

# Server name: edit inline and save on blur, no Muokkaa/Tallenna

Jari, 2026-10-16 ~19:05 local, Asetukset → Palvelin → Palvelimen nimi: works, but is clumsy: first press Muokkaa, then edit the text, then press Tallenna. "Siinä voisi olla vain tekstikenttä ja sitä voisi muokata." The value should be an editable text field that saves when focus leaves (or as the person types, debounced), with no separate save button. Apply the same pattern to other single-value settings where it fits; show quiet saved/failed feedback next to the field.

## Acceptance Criteria
- [ ] Server name is an inline field saved on blur; failure keeps the typed text and says so (browser test, paired screenshots desktop/phone).
