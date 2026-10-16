---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: done
priority: high
lane: web
lane_seq: 4
collision: [web/src/app/, web/src/components/]
blocked_by: ['@implement-conversation-details']
preparation: ready
commits:
- hash: d8a7d74c0b3d4ef996767ca95cecada7c4daaeaf
  summary: verified sequential test-server delivery
closed: 2026-10-16
---

# Implement workspace page (Keskustelut edellä)

Implement the workspace page that Jari accepted on 2026-10-16: direction 1, **Keskustelut edellä**, of round `2026-10-16-tyotilasivu`. Read `issues/proto-workspace-page/result.md` and its Decisions.

- The Git status is direction 1's pill-button in the page head (`main · 2 muutosta ↑1`), and it opens the Git layer.
- Worktree agents are not in the + layer and are not a group of their own on the page; their display comes from `proto-spinoff-agents` once Jari has evaluated it.
- The sidebar + and the workspace + create a new conversation with the default agent directly, with no menu.
- The … menu is as prototyped.

## Acceptance Criteria
- [x] Matches the round in lab screenshots (desktop and phone, light and dark), with deviations justified.
- [x] Browser tests for the Git pill and layer, + creating a conversation directly, and the … menu.
- [x] Deployed, with live checks in KOKEILTAVAA.md.
