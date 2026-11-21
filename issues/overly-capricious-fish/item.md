---
created: 2026-11-22
updated: 2026-11-22
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m801jsmhdecx7jfytgacejpc/review-finding:sha1:e4bfb013049b41f1f805ed5cdebfa9106060793b
review_source: ai-review
originating_run: 01m801jsmhdecx7jfytgacejpc
originating_run_kind: spinoff
labels:
- ai-review-model:gpt-6-astra
- ai-review-model:claude-fable-5-2
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: must-fix
review_target: 913ba09b
---

# Upgrade work census cannot see daemon work behind an idle controller state

## Description

# Upgrade work census cannot see daemon work behind an idle controller state

## Problem

The upgrade preview and the apply proof count each person's `active_turns` from the predecessor release's `open-habitat agent conversation list --json` (`internal/host/upgrade_native_linux.go`, `activeTurns`). Since the history-catalog fix, only a row's controller `state` decides. But the list emits the raw controller state (`internal/daemon/agent_conversation_list_linux.go`, `row["state"] = s.state`), and the daemon's own activity definition (`heldActivity` / `classify` in `internal/daemon/pi_activity_linux.go`) treats more as busy than that state shows:

- a browser bash command on a ready Pi sets only `run.state = "running"` (`internal/daemon/bash_linux.go`, `startCommand`); the conversation stays `idle`;
- automatic or requested naming (`s.naming`), the settle window after a turn (`settled && settlement == nil`), recap, and Pi background processes started through the process bridge;
- a history title operation on a conversation without a handle launches a temporary Pi and a title-model child with no handle at all (`internal/daemon/history_title_linux.go`, `nameHistory`), so its row has no state;
- a handle whose workspace was moved or removed out of band is skipped from the list entirely (`agent_conversation_list_linux.go`, the `ws == ""` continue).

All of these are daemon children that `KillMode=mixed` cuts when the upgrade stops the daemon.

## Impact

Consent is not bypassed: `interruptionRequired` asks for interruption consent for every live daemon. But an unattended installer waits for `active_turns == 0` as a quiet window before applying with that consent. While history rows were counted as active, no host with history ever looked quiet, which masked these gaps. Now a quiet window can be chosen while a browser bash command, a dev server started by Pi in the background, or a title operation is running, and it is cut.

## Verification

Read from the code at the fix commit; confirmed independently by a second model's refutation pass. Synthetic reproduction: a conversation whose Pi runs a long background process and whose controller state is `idle` lists as `{"lifecycle":"live","state":"idle"}`, which counts 0.

## Proposed direction

Expose the daemon's own work census (the same `classify` used by workspace fences: held activity, Pi background processes asked from the bridge, unknown when unreadable, plus handle-less temporary work such as history naming and controllers outside the rail) on the agent socket, and have the upgrade read it when the predecessor provides it, falling back to the list for older predecessors. This is a new agent route and contract, so it helps only from the release that ships it as a predecessor.
