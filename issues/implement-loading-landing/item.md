---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/]
preparation: ready
---

# Implement loading landing (Merkki)

Implement the loading landing that Jari accepted on 2026-10-16: direction 1, **Merkki**, of round `design-system/prototypes/rounds/2026-10-16-latausnakyma/`. Read `issues/proto-loading-landing/result.md` and its Decisions. The shared rules apply: no flash before 300 ms and a 500 ms minimum once shown, the slow-load line after 8 s, failure in place with Yritä uudelleen, and reduced motion. Keep the placeholder mark until a real mark exists.

## Acceptance Criteria
- [ ] Matches the round in paired lab screenshots (desktop and phone, light and dark; fast, slow and failed loads).
- [ ] Browser tests for no-flash, slow and failure.
