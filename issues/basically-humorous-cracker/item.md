---
created: 2026-11-23
updated: 2026-11-23
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m839b5g98z2rg3enavw2g4bk/flake:TestAgentConversationControls
originating_run: 01m839b5g98z2rg3enavw2g4bk
originating_run_kind: spinoff
---

# TestAgentConversationControls fails intermittently with writer_conflict on archive

## Description

# TestAgentConversationControls fails intermittently with writer_conflict

`./scripts/test-focused.sh --area go --go-package ./internal/daemon` failed once
(2026-11-23) in `TestAgentConversationControls`:

```
agent_conversations_linux_test.go:118: POST /agent/v1/conversations/<uuid>/archive: 409 {"error":{"code":"writer_conflict",...}}
```

The next two runs of the same package on the same tree passed in full, and the
branch did not touch the conversation archive path or its writer lock. An
earlier run that day also failed in `./internal/daemon` with no test name in
the captured tail. The archive request in the test seems to race a writer
still holding the conversation's writer lock from an earlier step of the
same test.

Impact: a red focused or gate run on unrelated changes, which costs a re-run
and makes a real daemon failure easier to dismiss.

Direction: make the test wait until the earlier step's writer has released
(observe the state it expects) before posting archive, or make archive's
conflict reply carry enough for the test to retry deterministically.
