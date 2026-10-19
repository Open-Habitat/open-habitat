---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: open
priority: normal
lane: web-polish
lane_seq: 2
collision: [web/src/app/]
preparation: ready
---

# Worktree-agent empty state and composer are misaligned

Jari on the test server (pilot.231, desktop, wide window), 2026-10-19, workspace page → **Uusi worktree-agentti**:

- The empty state (branch icon, "Uusi worktree-agentti työtilassa issuectl", text) is centred in the left part of the content area, while the composer starts at the middle of the page and extends right: the empty-state text is centred on the composer's left edge rather than over the composer. In an ordinary new conversation the composer is a centred column. The worktree-agent view's layout is broken at this width.
- No choice or naming of the worktree/branch was offered before the first message (by design: first message makes `wt/<message start>`); fine, but note it if the design wants it visible.
- The model chip shows only "Pi" instead of the model (ordinary conversation shows `claude-opus-5-5 · medium`).
(The first message then failed with "Liian monta käynnissä olevaa keskustelua"; that is `idle-pi-holds-slots`, not this issue.)

Fix the layout so the empty state and composer share the conversation column as in an ordinary new conversation, and show the model chip as for other new conversations. Check desktop wide, narrow and phone, light and dark.
