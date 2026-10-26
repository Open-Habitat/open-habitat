---
created: 2026-10-26
updated: 2026-10-26
type: bug
status: untriaged
priority: normal
provenance: test-failure
source_ref: taskfleet:01m5wn54hvqw2bzbr82qwnhpc3/browser-flake:lost-accepted-reply-http
originating_run: 01m5wn54hvqw2bzbr82qwnhpc3
originating_run_kind: spinoff
---

# Browser flake: lost accepted reply recovers on HTTP snapshot fails under whole-suite load

## Description

`web/tests/browser-conversation.spec.ts:2299` "@browser-conversation lost accepted reply recovers on HTTP snapshot without an event" failed once in a whole-suite `npm run test:browser --prefix web` on Birch (2026-10-26, worktree of agent-knows-site-origin based on main 8d6a97c0; 400 passed, 1 failed, 3 skipped, 8 workers):

    Error: expect(locator).toBeEnabled() failed — Timeout: 5000ms — element(s) not found
      at web/tests/browser-conversation.spec.ts:2345:5

The same test then passed 3/3 run alone (`./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag "lost accepted reply recovers"`). The branch changed no web code (only generated contract fingerprints), so this is a load-dependent flake. The same case was named in the closed `gate-load-flakes-1019` investigation, whose rechecks passed under load at --workers=2; this run used the default 8 workers. A recurring flake in the whole-suite run makes every worker's browser check ambiguous.

Direction: reproduce with `--repeat-each` at the default worker count and find which wait at line 2345 assumes timing the loaded host does not give.
