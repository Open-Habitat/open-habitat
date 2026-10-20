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
