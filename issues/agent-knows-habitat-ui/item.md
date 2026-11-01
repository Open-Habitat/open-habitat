---
created: 2026-11-01
updated: 2026-11-01
type: feature
reporter: jari
status: done
priority: normal
lane: agent-knows-habitat-ui
lane_seq: 1
related: ['@proto-conversation-header-actions-r3']
preparation: ready
closed: 2026-11-01
---

# The agent knows the whole Habitat interface and can help with it

Jari 1.11.: Open Habitat itself knows its user interface: every button, its meaning, keyboard shortcuts, settings, sections and views, so the person can ask their agent anything about the interface and get a correct answer. The whole interface, not only the conversation header (`proto-conversation-header-actions-r3` proposed an `open-habitat-ohje` skill; its `result.md` has the host facts). Default design (record alternatives under Decisions for later review): a skill shipped and installed like the start-page skill, its reference generated at build time from the browser's text catalogs (both languages), the settings index and the keyboard-shortcut definitions, so it cannot drift from the UI; a check in the gate fails when the generated reference is stale. The agent's host context says the skill exists and when to use it. No screenshots in the skill; text only. Not gated: it adds knowledge, no visible UI.
