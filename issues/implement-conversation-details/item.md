---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: done
priority: high
lane: web
lane_seq: 3
collision: [web/src/app/, web/src/components/, internal/daemon]
preparation: ready
closed: 2026-10-16
commits:
- hash: 05775a7fe8e715685fa9c8f202aa296939dfbd74
  summary: verified sequential test-server delivery
---

# Implement conversation details: failed card cause, archive notice, Kertova

Implement the three conversation details that Jari accepted on 2026-10-16. Read `issues/proto-conversation-details/result.md` and its Decisions; the rounds are the specification.
1. **Failed bash card, "Syy kulmassa"** (round `2026-10-16-epaonnistunut-komento`): the corner names the cause (`× paluuarvo 2`, `× aikakatkaisu 30 s`, `× keskeytetty`), the card has a red left edge, Pi's own status line leaves the output (its text is in the corner's tooltip), and the thread summary gets "· n epäonnistui". The daemon reads Pi's fixed-format status line into a structured field, falling back to `epäonnistui`.
2. **Archive notice, "Hetki alhaalla"** (round `2026-10-16-arkistoitu`): a bottom bar for 8 s that pauses on hover or focus; Palauta returns to the conversation.
3. **Viimeisimpään, "Kertova"** (round `2026-10-16-viimeisimpaan`): a centred pill with the state in words, with the unseen-message count retained, including during work (Jari’s follow-up).

## Acceptance Criteria
- [x] Each detail matches its round in lab screenshots (desktop and phone, light and dark), with deviations justified.
- [x] Browser tests: the failed-card corner and summary count; the notice timeout, pause and Palauta; the Viimeisimpään states and visibility.
- [x] Deployed, with live checks in KOKEILTAVAA.md.
