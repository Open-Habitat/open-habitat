---
created: 2026-10-16
updated: 2026-10-16
type: improvement
status: done
priority: normal
provenance: ai-review
source_ref: taskfleet:01m52p93xx5dd5fqg6d73ey9tc/review-finding:no-request-durations
review_source: ai-review
originating_run: 01m52p93xx5dd5fqg6d73ey9tc
originating_run_kind: research
labels:
- ai-review-model:claude-opus-5-5
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_target: e9bec7d5
lane: server-admin
collision: [internal/gateway, internal/daemon]
closed: 2026-10-16
---

# Live logs record no request path or duration, so slow actions cannot be diagnosed

## Description

Observed 2026-10-16 while investigating Jari's report that archiving a workspace is slow (`ui-responsiveness-review`, `archive-workspace-restore`). A read of the test guest's gateway and `open-habitat-daemon@maintainer` journal for 15:00–16:30 UTC held only `oauth_callback`, `service_ready`, one `conversation_title` record and systemd start/stop lines. No record names a request path, status or duration. So neither the time of the slow workspace POST nor that of the following `/api/v1/snapshot` could be established from the logs. A parallel session had to measure the snapshot by hand with `curl` on the daemon socket plus `strace` (1.1–2.4 s, commit `5f8a86c9`); that method doesn't scale to routine diagnosis, and it still left the POST unmeasured. The plus-live-cause investigation hit the same wall: its `daemon_exchange_failed` records "cannot prove which request failed" (`issues/plus-live-cause/live-evidence.md`).

Proposed: one JSONL record per finished proxied request in the gateway (operation class from `proxyOperation`, method, status, duration in ms, verified user), and per snapshot in the daemon (total plus the durations of discovery, git status, session scan and process inventory). No paths with IDs, no bodies, no conversation content, in line with ADR 0013. Check whether this counts as "routine noise" under ADR 0013; if it does, put it behind a slow-request threshold (for example ≥300 ms) instead of logging every request.

Value: the migration proposed in `issues/ui-responsiveness-review/analysis.md` (steps 1 and 5) should be chosen and verified from live durations, not lab estimates.
