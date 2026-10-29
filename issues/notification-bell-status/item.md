---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
lane: top-bar
lane_seq: 1
preparation: ready
closed: 2026-10-29
---

# Top bar bell for account-wide conditions (Tila)

_Source: chat_

## Description

Implement `proto-notification-bell` direction **Tila** (Jari 29.10.): a bell in the top bar appears only while an account-wide condition holds (storage near its limit, new version, GitHub connection problem, administrator overcommit, as the prototype's inventory places them), danger stated in words, opens what it is about; no dismissal, it goes away when the condition clears. The connection banner, undo notices and in-conversation notices stay where they are. No notification store.

## Acceptance Criteria

- [x] Bell with the conditions the result lists, from existing native facts; desktop and phone; light and dark.
- [x] The strips it replaces are removed where the bell now carries them.
- [x] Browser specs; KOKEILTAVAA line.
