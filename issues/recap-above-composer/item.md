---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: open
priority: normal
related: ['@add-conversation-recap', '@new-conversation-view']
lane: signin-fix
lane_seq: 9
collision: [web/, internal/daemon/]
---

# Recap appears automatically above the composer and can be closed

_Source: chat_

Jari, 2026-10-12, pilot.22: the conversation recap ("Tilannekatsaus") card floats oddly at the top of the conversation area and cannot be closed. Jari's intended behaviour and layout:

- **Automatic.** A recap is generated automatically after the conversation has been inactive for more than 3 minutes. The earlier implementation (`add-conversation-recap`, `docs/architecture/conversations.md`) left the automatic trigger out because browser focus is not an honest idle signal. The daemon has an honest one: Pi has settled (verified completion) and no new native message for 3 minutes. Generate only when there is something newer than the latest recap; never while a turn runs; one generation per idle period, safe across reconnects and several open tabs.
- **Placement.** The card appears directly above the message composer, not at the top of the transcript, and the person can close it. A closed card stays closed until a newer recap exists.
- **Header row.** "Tilannekatsaus" followed immediately by the relative age ("10 min sitten", "2 t sitten") instead of a separate "Luotu" line. A refresh control as a circular two-arrow icon button at the right end of the title row.
- **Contrast.** The current "Päivitä katsaus" button has the same colour as its background; the icon button must be clearly visible and keep an accessible label.
- Not shown in an empty conversation (see `new-conversation-view`).

Update `docs/architecture/conversations.md` for the automatic trigger, and verify in the lab: idle trigger, close and reappear on a newer recap, refresh, stale label, desktop and phone.
