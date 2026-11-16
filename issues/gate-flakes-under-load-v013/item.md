---
created: 2026-11-16
updated: 2026-11-16
type: bug
reporter: conductor
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-16/gate-flakes-under-load-v013
---

# Clean gate flakes under host load: editor conflict typing, pinned Pi bridge wake

## Description

Third clean gate on main 8729089f (staging installation, 16.11.2026; load average 10-15 from another session's CPU-heavy job) failed in two tests that passed in the two earlier runs:

- web/tests/browser-editor-concurrent.spec.ts:164 '@browser-editor @a11y a conflict waits for a choice, each choice is undoable, and keeping one's own line leaves a note for the agent 1366': editor-document expected 'println("minun")' but held 'println("heiminun' followed by 'println("agentti")' — the person's typed text merged with leftover text and lost its closing. Possibly a real lost-keystroke race between local typing and an incoming agent edit, not only test timing.
- internal/daemon TestProcessPinnedPiBridgeAndWake (process_native_linux_test.go:106): missing native notify join.

Log: /var/tmp/agent-keep/gate-v013/v013-3.json (private host path). Each of the three gate runs today failed on different load-sensitive cases; see also browser-conversation-repeat-flakes.
