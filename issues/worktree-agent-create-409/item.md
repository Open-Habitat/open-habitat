---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: high
lane: worktree
lane_seq: 1
collision: [worktree-create]
---

# New worktree agent: first message fails with 'Toinen muutos oli juuri kesken'

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 ~12:19 local (pilot.247): Työtila open-habitat › Uusi worktree-agentti, typed 'No niin. Missä branchissä olemme?' and sent. Result: card 'Keskustelua ei luotu: Toinen muutos oli juuri kesken. Yritä uudelleen.' and the message returned to the field. Server log: daemon POST /api/v1/conversations status 409 in 0 ms at 09:19:16Z (request_id akoQWAdgzBibbo-K), i.e. rejected immediately as a concurrent mutation without doing work. Find what holds the mutation guard (a stale/pending mutation, the worktree path, or a client double-submit) and fix; 'Yritä uudelleen' must work, and a genuine conflict must say what is in progress. Done: lab reproduction of creating a worktree agent from an existing workspace, regression test.

## Comments

### 2026-10-20T09:37:26Z · @agent

Reproduced locally before the fix: TestWorktreeCreationWaitsForWorkspaceWriter fails with 409 workspace_busy while a simulated checkout observation holds cloneWriter for only 25 ms. Root cause: worktree creation uses an immediate TryLock on the daemon-wide workspace writer; read-only GitHub checkout observations hold that same lock across native Git checks, while imports hold it for the entire job. Thus even a brief overlap refuses a single first-message create before any work; the refusal contains no holder information. No double-submit or stale-lock mechanism is needed to reproduce it. The quoted live log proves this refusal path but cannot identify its holder: inspect requests overlapping 09:19:16Z, especially GET onboarding/github/checkout, clone job start/terminal events, archive, workspace delete/restore/settings and worktree cleanup. No server was accessed.

## Acceptance Criteria

- [x] Reproduce brief workspace-writer contention and cover bounded admission, no-write refusal, cancellation and explicit retry in daemon tests.
- [x] Identify a genuine conflict's operation without exposing paths or native errors.
- [ ] Run the host-backed worktree-agent lab journey, including retry and accessibility assertions.
- [ ] Record paired before/after lab screenshots and static HTML.

## Result

[Worker result and exact remaining checks](result.md). Implementation is committed
for continuation, but lab execution is blocked by Alder's focused runner policy;
this is not a completed/merged fix.
