---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: open
priority: normal
lane: proto-conversation-header-actions
lane_seq: 1
preparation: pending
---

# Prototype: conversation header buttons a person understands

Jari 1.11.: Kaisa did not understand the conversation header's buttons (`issues/icon-tooltips-slow/attachments/header-icons.png`: editor, terminal, queue, recap, archive, details as bare icons). A faster tooltip (`icon-tooltips-slow`) helps a mouse user who already hovers, not a first-time user or a phone. Prototype how the header's actions become understandable: baseline as on main, then 2–3 directions on one axis (for example icon with a short word, fewer visible actions with the rest in a menu, different icons, a first-use explanation), in production context, desktop and phone, light and dark, Finnish texts, with each action's meaning stated. Read `issues/proto-conversation-header` and `conversation-header-shorten` from history for what was decided before (`scripts/from-history.sh`).
