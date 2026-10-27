---
created: 2026-10-27
updated: 2026-10-27
type: bug
status: open
priority: high
provenance: other
provenance_detail: worker test run
source_ref: taskfleet:01m5y9fnq843aaekexbe3smjvj/flaky:browser-conversation-141
originating_run: 01m5y9fnq843aaekexbe3smjvj
originating_run_kind: spinoff
lane: gate-health
lane_seq: 1
preparation: ready
---

# Flaky: saved assistant turn's bash row missing after reload (browser-conversation.spec.ts:141)

## Description

`web/tests/browser-conversation.spec.ts:141` ("@browser-conversation saved assistant turn exposes bash command and folds work without hiding reply") fails intermittently on `main` (d732c059) on Birch: run alone with `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag "saved assistant turn exposes bash"`, it failed 3 of 5 times in a detached `main` worktree on 2026-10-27, and also in one whole browser-suite run. It is not in `main-browser-suite-red`'s list.

Failure: after `page.reload()` and clicking `history-stage-toggle`, the bash tool row's `history-tool-toggle` is not found within 5 s (`expect(bash).toHaveAttribute("aria-expanded", "false")`, line 159: "element(s) not found"). The assistant reply "Selvä. Kysyit:" was visible before the reload, so the turn exists; the folded work stage after reload sometimes renders without the bash tool row (or the toggle opens before the history window with the tool call has loaded).

Impact: the whole browser suite is red on an unrelated flake, and workers chase it. The underlying cause may also be a real race in how a reloaded conversation's work stage shows its tool calls.

Next step: reproduce with repeated runs, see whether the stage toggle can be pressed before the tool entries arrive, and fix the race in the product or the spec.

## Decisions

### 2026-10-27T12:59:39Z · @jari

Jari 2026-10-27: työhön (konduktorin suositus).
