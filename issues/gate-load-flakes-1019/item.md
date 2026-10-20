---
created: 2026-10-19
updated: 2026-10-20
type: bug
status: fixed
priority: high
related: ['@gate-gateway-restart-write-503', '@gate-empty-close-writer-conflict']
lane: gate-health
lane_seq: 3
collision: [gate]
preparation: ready
closed: 2026-10-19
---

# Gate still red on three load-sensitive cases (19.10.)

After `main-gate-red-1019` the full clean gate on `ca6ec761` (2026-10-19) is still red on three load-sensitive cases that pass alone (details and log path in `issues/main-gate-red-1019/result.md`, section on the full gate): `browser-conversation.spec.ts:1059` warm controlled return quiescence never holds within 5 s; `native-history.spec.ts:84` unwritten terminal archive helper cannot find Arkistoi in the agent header; `TestProcessResumeCatchUpAcrossDaemonRestart` (line 210) re-reads the process inventory after a successful poll and gets no interrupted records under concurrent load. The earlier `worktree-archive-409-under-load` (untriaged) is probably the same family as the second. Make each deterministic (wait on the condition, keep the accepted observation, hold/release instead of timing) or fix the product race if one is real, until the full gate passes.

## Acceptance Criteria

- [x] Reported browser cases and worktree archive pass repeated parallel load.
- [x] Restart catch-up passes repeated load without re-reading the accepted census or sleeping for publication.
- [x] Full clean gate passes on a committed clean worktree and its receipt is reported.

## Reopen Notes — 2026-10-19

_Add rationale for reopening here._

## Reopen Notes — 2026-10-19

_Add rationale for reopening here._
