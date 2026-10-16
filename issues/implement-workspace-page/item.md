---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: web
lane_seq: 4
collision: [web/src/app/, web/src/components/]
blocked_by: ['@implement-conversation-details']
preparation: ready
---

# Implement workspace page (Keskustelut edellä)

Implement the workspace page that Jari accepted on 2026-10-16: direction 1, **Keskustelut edellä**, of round `2026-10-16-tyotilasivu`. Read `issues/proto-workspace-page/result.md` and its Decisions.

- The Git status is direction 1's pill-button in the page head (`main · 2 muutosta ↑1`), and it opens the Git layer.
- Worktree agents are not in the + layer and are not a group of their own on the page; their display comes from `proto-spinoff-agents` once Jari has evaluated it.
- The sidebar + and the workspace + create a new conversation with the default agent directly, with no menu.
- The … menu is as prototyped.

## Acceptance Criteria
- [ ] Matches the round in lab screenshots (desktop and phone, light and dark), with deviations justified.
- [ ] Browser tests for the Git pill and layer, + creating a conversation directly, and the … menu.
- [ ] Deployed, with live checks in KOKEILTAVAA.md.
