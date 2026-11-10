---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed during live view-address verification
source_ref: taskfleet:01m71zxwc5x5wq5mg4cwzv029x/observation:withdrawal-sockets-jit-gate
originating_run: 01m71zxwc5x5wq5mg4cwzv029x
originating_run_kind: spinoff
---

# Withdrawing a person leaves their sockets active and the test guest's JIT gate then refuses every socket start

## Description

Observed on the disposable test server on 2026-11-10 while verifying view addresses end to end.

Withdrawing a runtime-admitted person (`open-habitat admin access remove --github-id <id>`, the same path as the administrator's browser withdrawal) does what the product promises: it denies the subject, removes their sessions and deletes their view addresses, and keeps the Unix account, its files and processes. Their `open-habitat-daemon@<user>.socket` and `open-habitat-agent@<user>.socket` stay active.

Fleetrepo's test-guest JIT gate (`jit_policy.py verify --phase activation`) then refuses every later socket start on the guest with `policy-refused: revoked sibling socket still active`. The next first login failed: the broker published the new binding, the gate refused its daemon socket, and `ensure`/`authorize` answered `state_unavailable` until root stopped the withdrawn person's two sockets and daemon service. Any daemon restart of an existing person would be refused the same way.

Impact: one browser withdrawal on the test server blocks new accounts and daemon restarts for everyone until an operator stops the withdrawn person's sockets by hand.

Decision needed (product vs. installation): either withdrawal should also stop the person's listeners through the broker (the person keeps their account but loses the gateway route anyway), or Fleetrepo's gate should accept an active but unrouted withdrawn sibling. Recovery used: `systemctl stop open-habitat-daemon@<user>.service open-habitat-daemon@<user>.socket open-habitat-agent@<user>.socket`, then `systemctl reset-failed` and start the refused sockets.
