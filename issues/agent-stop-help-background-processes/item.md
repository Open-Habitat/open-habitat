---
created: 2026-11-23
updated: 2026-11-23
type: bug
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m84f790sn3vszrv2j1vx7sae/review-finding:stop-help-background-lifetime
review_source: ai-review
originating_run: 01m84f790sn3vszrv2j1vx7sae
originating_run_kind: spinoff
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: medium
review_target: internal/cli/help.go
---

# Agent stop help promises that background tools survive

## Description

The personal CLI's `agent conversation stop --help` says it stops Pi but not its detached tools. The current implementation also shuts down that Pi's managed background processes. An agent relying on this promise can stop a conversation expecting a long-running process-tool job to survive, losing that work.

Observed without stopping any live conversation: source-built help and the installed 0.1.6 help both print the promise. In `internal/daemon/conversation_linux.go`, `ConversationController.stop` calls `s.rpc.close()`. In `internal/daemon/pi_rpc_linux.go`, `piRPC.close` first sends the process bridge a `shutdown` operation. In `internal/daemon/process-extension.mjs`, that operation kills every live managed process with SIGKILL. Taskfleet workers and separately owned user services are a different category and need not end with Pi.

Correct the help description in `internal/cli/help.go` to distinguish conversation-owned process-tool jobs from independently owned work. The personal skill is being corrected separately; changing actual stop behavior is not requested. Reproduce by reading `open-habitat agent conversation stop --help` and tracing the shutdown path above; do not stop a person's conversation as a test.
