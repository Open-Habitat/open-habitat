---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: open
priority: normal
lane: web-feedback
lane_seq: 2
collision: [web/src/components/Navigation.tsx]
preparation: ready
---

# Rail marks: pulse only the dot; agent working dot

Jari on the test server, 2026-10-17 ~17.50 (B6, `sidebar-spinoff-mark-without-wait`): "siinä pitäis vaan sykkiä itseasiassa se yks pieni pallo osalta ja se haara, eikä se koko merkki. Sitten mä pistin merkille, että kun se itse agentti tekee, niin se agentin pallo ei syki kunnolla, vaan on vaan semmonen harmaa katkoviiva siinä. Niin kuin se vieressä oleva agentin oma merkki."

1. While a spinoff works, only the small dot of the branch mark should pulse, not the whole mark.
2. When the agent itself is working, its own status dot in the rail row does not pulse properly; it shows as a grey dashed ring. It should show the working state the same way (pulsing dot) as the design draft. Check what state the row receives during a live turn and why it renders as the dashed (idle/unknown?) variant.

## Acceptance Criteria
- [ ] Spinoff working: only the dot pulses; agent working: the agent dot pulses. Lab screenshots or a short frame series in both themes, and a test that a working turn maps to the working variant.
