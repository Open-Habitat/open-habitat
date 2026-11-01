---
created: 2026-11-01
updated: 2026-11-01
type: bug
reporter: jari
status: open
priority: normal
lane: rename-slow-when-resting
lane_seq: 1
preparation: ready
---

# Renaming a resting conversation takes seconds to show

Jari 1.11. (pilot.572, desktop): a rename shows in the UI with a delay. In the daemon journal the first rename of a conversation, `POST /api/v1/conversations/{id}/…`, took 2298 ms (14:03:27Z, Pi resting; followed by `continue` 818 ms); a second rename 13 s later took 6 ms. The slowness looks like renaming a resting conversation (starting Pi or writing through it). Fix both ends: the browser shows the new name at once (optimistic, reverting with a message if the host refuses), and the host renames a resting conversation without the multi-second path if the native session allows it (`internal/daemon/conversation_name_linux.go`, `conversation-manual-name`). Fix to existing behaviour: not gated.
