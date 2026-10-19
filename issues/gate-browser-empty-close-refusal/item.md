---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:browser-empty-close-refusal
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
---

# Real-controller browser empty close intermittently returns writer_conflict

## Description

## Observed failure

The final rebased clean gate failed the unchanged browser test `browser-conversation.spec.ts:2447`, "empty browser conversation closes without confirmation". It creates an empty real-controller conversation, waits for the enabled Close control, clicks it, and expects the header control to disappear. The route moved optimistically toward the workspace but the control returned/remained; the five-second assertion found one Close button instead of zero.

The retained trace confirms POST /close returned 409 `writer_conflict`. Extracted trace `/var/tmp/oh-trace.C89fM1NJ`, original `web/test-results/browser-conversation--brow-1b8f0-closes-without-confirmation-chromium/trace.zip`. Complete gate log `/var/tmp/oh-harvest-rebased-final-clean-gate.log` on Alder, revision f43cb631988e559fe58dd6eff6820d1f0c999262, tree e29e85818206d3c8ec30deefadb3b8e25c0ce75b, 371 s.

The isolated unit census repair in @gate-empty-close-writer-conflict does not change the production controller's host-wide /proc default. Earlier loaded browser close repetitions and two completed browser gates passed this journey, but the real controller can still refuse a later uncertain census or retained writer lock. The trace alone does not distinguish those two branches. Capture the exact refusal branch before changing native safety or retrying a close, especially after child exit. No product race or competing writer is yet proven.

## Reproduction

Repeat the original browser case at eight workers concurrently with the full Go/race suite, using synthetic isolated browser hosts. This is an observed intermittent failure, not a deterministic reproducer.

## Impact

The clean gate remains intermittently red on actual controller empty-close admission. Production writer fences must not be weakened to satisfy a synthetic test. No live user, data loss or provider behavior is established.
