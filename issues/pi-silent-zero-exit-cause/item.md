---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m7crrar237qm1jfey7sfkpq7/remaining-exit-cause
originating_run: 01m7crrar237qm1jfey7sfkpq7
originating_run_kind: spinoff
---

# Identify the remaining silent Pi status-zero exit with input open

## Description

A reported empty browser conversation ended when Pi exited status 0 while Habitat still held its stdin open. Repeated wake-on-typing continue requests preceded a held message and cancel_held. The person had to open a new conversation. The original journal proved the unexpected exit but not its cause.

The diagnostics work for pi-unasked-exit-status-zero adds bounded fixed stderr classes plus burst recency to conversation_pi_ended. It does not establish whether an extension requested ctx.shutdown(), nor can stderr prove a silent shutdown cause.

An installed Pi 1.5.2 / Node 22.21.1 attempt using a synthetic home, an empty conversation, five continues, a held send and cancel_held left Pi alive. Startup was delayed by a synthetic extension so cancellation happened before readiness; no credentials or personal extensions were used. The attempt observed three seconds after readiness and did not reproduce the original later exit or its 409 response.

## Next investigation

Use the new stderr_class and stderr_recency on a fresh occurrence to narrow the cause; seek a synthetic extension/settings reproducer rather than personal logs. The opt-in TestRuntimePiWakeCancelExitRepro accepts OH_EXIT_REPRO_RUNTIME pointing at a runtime payload. Extend the observation period and synthetic extension cases as needed. Installed Pi RPC handles SIGTERM/SIGHUP with exit 143/129, while ctx.shutdown() and stdin end can exit 0; there is no evidence yet attributing the original event to any of those paths. Do not label it an upstream defect until reproduced.
