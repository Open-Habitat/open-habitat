---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: agent-host
lane_seq: 4
collision: [internal/daemon/pi]
---

# Live: agent notice create fails with agent_unavailable

## Description

Live retest 2026-10-23 05:29 UTC (Jari, new conversation pi:da15ad07, release e7872708 which contains `agent-notice-not-discoverable`): discovery now works — the agent's first call was exactly `open-habitat agent notice create --current --idempotency-key <uuid> --text '…' --json` — but it failed: `{"error":{"code":"agent_unavailable","message":"native operation failed or is uncertain; …"}}`, exit 2. `notice list --current` then returned no notices. The daemon/gateway journal around 05:29–05:31 shows no notice-related event at all, so the failure reason is invisible.

The worker of `agent-notice-not-discoverable` accepted one-call creation with real Pi on a synthetic host; the live host differs. Find why the CLI → own-user daemon notice route returns agent_unavailable on the real installation (socket path/ACL for the agent process, `--current` resolution of the conversation id inside a Pi tool subprocess, environment the Pi tool shell inherits, the release's paired agent socket), make the failure log a specific reason, fix it, and verify on the test VM read-only plus a synthetic reproduction of the live difference.

## Acceptance Criteria

- [ ] Root cause stated with evidence; regression reproduces the live condition; a live retest by Jari creates the notice in one call.
