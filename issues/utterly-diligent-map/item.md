---
created: 2026-11-27
updated: 2026-11-27
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: 'GitHub issue #1'
source_ref: https://github.com/Open-Habitat/open-habitat/issues/1
lane: unlaned
preparation: ready
closed: 2026-11-27
---

# Dictation: out-of-credit Soniox account shows as "Soniox is not responding"

## Description

Dictation: out-of-credit Soniox account shows as "Soniox is not responding"
https://github.com/Open-Habitat/open-habitat/issues/1

When the Soniox account has run out of credit, dictation fails with "Soniox is not responding / Dictation did not start. Try again in a moment." (fi: "Soniox ei vastaa"). The user has no way to tell that the problem is billing.

Diagnosing it from the host side does not help either: with zero balance the key still gets a temporary key from `POST /v1/auth/temporary-api-key` (201) and `/v1/models` answers 200, so everything looks fine on the server. Only the real-time WebSocket session fails.

Suggestion:
- Map the WebSocket error Soniox returns for an exhausted balance to the existing "usage limit reached" notice (`limitReached`), or a new one that says the Soniox account may be out of credit.
- At minimum, add to the "not responding" text: "Check that your Soniox account has credit" with a link to the Soniox console.

Observed 24.11.2026 on Open Habitat 0.1.3 with a personal Soniox key (US region). Dictation worked again once credit was added.

## Decisions

### 2026-11-27T07:52:39Z · @jari

Jari 27.11.2026: fix it.

## Resolution

### 2026-11-27T07:58:39Z · @issuectl

402 from the Soniox stream now says the account is out of credit, with a console link; 'not responding' also suggests checking credit. See result.md.
