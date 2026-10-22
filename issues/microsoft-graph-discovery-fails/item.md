---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: integrations
lane_seq: 2
collision: [internal/daemon/integrations]
---

# Microsoft 365 sign-in fails at Graph discovery after the device code

## Description

Jari 2026-10-22 15:25 on pilot.314 (4a8166a0): Microsoft 365 sign-in fails after the device-code step with "Kirjautuminen ei onnistunut. Mitään ei yhdistetty." Twice the daemon logged `integration_login provider=microsoft outcome=failed phase=graph_discovery reason=tool_failed` (12:24:45Z, 12:25:29Z). The earlier issue `integration-signin-failures` (closed) added the phase logging; its live retry shows the failure is in Graph discovery, but the log does not name the failing tool, call or Graph error. Redacted excerpt: `issues/integration-signin-failures/live-2026-10-22/daemon-integration-lines.txt`.

Open product question from that issue (one or two device codes; work vs. personal account): Jari has not answered it yet, so keep both account kinds working unless the code shows one is unsupported.

## Acceptance Criteria

- [ ] The failure reason is diagnosable from the daemon log without secrets (tool, exit status, HTTP status, Graph error code/message, tenant kind).
- [ ] The root cause is found from the code and reproduced with a synthetic fixture where possible, and fixed; the dialog tells the person what went wrong in plain Finnish when it is not fixable on our side (e.g. tenant admin consent required).
