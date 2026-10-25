---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: jari
status: in-progress
priority: normal
lane: unlaned
collision: [web/src/components/Navigation]
---

# Sidebar 'Uutta 1' badge is cryptic and not actionable

## Description

Jari, 2026-10-25 (Birch, pilot.11), with a screenshot: "Välillä sivupalkkiin ilmestyy tuollainen teksti Uusi 1 joka on mulle täysin cryptinen." (In short: sometimes the sidebar shows "Uutta 1", which is completely cryptic to him.)

The rail shows `<Badge label="Uutta" tone="warning" count={attentionCount} />` under Etusivu (`web/src/components/Navigation.tsx`). The count is the number of conversations whose attention is `"new"` (`WorkspaceRailView.tsx`: an agent reply the person has not seen yet). The badge does not say what is new or where it is, and it is not interactive. On a phone-sized rail it looks like a disabled input field.

## Acceptance Criteria

- [x] The rail item says what it means in plain Finnish, for example "1 uusi vastaus" / "3 uutta vastausta" (or a better wording that matches the rest of the UI's vocabulary for unread agent replies), and looks like an action rather than a field.
- [x] Activating it takes the person to the unread reply: with one, straight to that conversation; with several, to a view that lists them (for example Etusivu's attention section, if that exists, or the first one, with the others still marked in the rail). Opening the conversation clears the count as today.
- [x] Keyboard and screen-reader accessible, with an accessible name that includes the count. Covered by unit/browser tests.
