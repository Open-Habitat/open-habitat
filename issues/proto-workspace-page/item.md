---
created: 2026-10-15
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-workspace
lane_seq: 1
collision: [design-system/prototypes/rounds/proto-workspace-page]
preparation: ready
closed: 2026-10-15
---

# Prototype: workspace page and the + menu

Jari 15.10.2026: every new feature is prototyped first; the working prototype Jari accepts is its specification, and implementation waits for his evaluation. The round is made in its own worktree under `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the `prototype` skill. Alongside it, an architecture sketch says how the server side would do it, in a separate file, following the project principles in `CLAUDE.md` (Unix users as the boundary, native tools own their history, credentials and processes; no parallel store or broker). The sketch is a proposal for Jari, not an accepted ADR.

From the prototype queue (TODO.md): the workspace page (what a workspace shows: conversations, worktree agents, Git state) and the workspace "+" menu as its own layer. Keep it consistent with `proto-worktree-agents`, which may add worktree work to the same page; read its round if it has landed. No architecture sketch is needed unless the page needs host facts that do not exist yet.

## Acceptance Criteria
- [x] Round verified with check.mjs; `result.md` per the prototype worker rules.

## Decisions

### 2026-10-16T05:30:20Z · @jari

Jari 2026-10-16: direction 1, Keskustelut edellä. Git as quietly as possible: nothing when everything is up to date, a restrained status only when something is not (changes, unpushed or unpulled commits). Worktree agents are not offered in the + layer and are not their own group on the page (see proto-worktree-agents). Conductor's decision: the sidebar + creates a new conversation directly, because without the worktree options the layer would have one choice. A riff round follows: proto-spinoff-agents.
