---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: open
priority: normal
lane: proto-conversation-header-actions-r3
lane_seq: 1
related: ['@proto-conversation-header-actions-r2']
preparation: pending
---

# Prototype round 3: ways to learn the header buttons

Jari 1.11. on `proto-conversation-header-actions-r2`: riff more creative ways to explain the header's icons, beside or instead of an automatic first-use card:
- its own **?** button that gives more information;
- **asking the agent**: the explanation comes from the conversation's own agent (for example a question it already knows how to answer, or a prompt the ? sends);
- the workspace's **start page** (*Aloita tästä*, `.agents/start-page.md`) as a tutorial where one exists;
- above the start page, a strip that shows the button icons with *Selitä nämä mulle* (or similar).
Baseline is round 2's riff 1; 2–3 riffs on where the explanation lives and who gives it, in production context, desktop and phone, light and dark, Finnish texts, one line per riff at the top of the page saying what differs. Say which host facts each needs (the start page's presence, the agent's ability to answer, any stored flag).
