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

- [x] The failure reason is diagnosable from the daemon log without secrets (tool, exit status, HTTP status, Graph error code/message, tenant kind).
- [ ] The root cause is found from the code and reproduced with a synthetic fixture where possible, and fixed; the dialog tells the person what went wrong in plain Finnish when it is not fixable on our side (e.g. tenant admin consent required).

## Current result

Secret-safe discovery diagnostics are implemented and tested. The historical
root cause remains unproven; this issue stays open under the brief's explicit
partial-delivery option. See `result.md` for evidence and the next live attempt.
A Graph failure now names the fixed request/validation step, direct HTTP tool
(no subprocess exit status), response status, allowlisted Graph code/message,
and observed drive/account kind. Unknown provider text is redacted rather than
risking addresses, tenant IDs, tokens or echoed input. Unknown account kind is
reported honestly until drive discovery supplies it.

## Comments

### 2026-10-22T14:49:52Z · @conductor

Live diagnostic retry 2026-10-22 14:38:56Z (1362b57f), Jari: business account. integration_login failed phase=graph_discovery step=site_drives tool=direct_http http_status=404 graph_code=itemNotFound tenant_kind=business. One SharePoint site's drives lookup 404s and fails the whole sign-in. Fix: a per-site 404/403 on drive discovery skips that site (logged, and shown to the person as an unavailable site if it was one they would expect), never fails the account; sign-in succeeds with OneDrive and the reachable sites.
