---
created: 2026-10-16
updated: 2026-10-16
type: improvement
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Remove 'Odottaa sinua' above the recap card

Jari, 2026-10-16 ~19:05 local: an "Odottaa sinua" text has appeared at the top of the Tilannekatsaus card. "Ei tätä mun mielestä siinä tarvitse sanoa. Miksi silloin vaan tilannekatsaus?" Remove it; the card's heading is just Tilannekatsaus. The sidebar's attention mark already says who is waiting.

## Acceptance Criteria
- [ ] The recap card shows no Odottaa sinua label (component test, screenshot).
