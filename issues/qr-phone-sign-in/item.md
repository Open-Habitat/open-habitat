---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: normal
---

# Sign in on a phone by scanning a QR code from Settings

Jari, 2026-10-16 ~19:05 local: "Olisi kiva, että saisin avattua asetuksista QR-koodin ja kirjauduttua puhelimella": Settings shows a QR code; scanning it with the phone opens Open Habitat already signed in as the same person, so he can test the phone UI without signing in again on the phone.

This moves sign-in authority: a QR code that carries a login is a bearer credential. It belongs to `internal/gateway` (the only component that authenticates the browser). Needs an architecture recommendation to Jari and an ADR before implementation: e.g. a short-lived, single-use, gateway-minted device-link token bound to the person's session, shown only after a fresh confirmation, expiring in about a minute, consumed on first use, listed and revocable as a signed-in device, never logged; versus alternatives (device-code flow where the phone shows a code and the signed-in desktop approves it, which avoids a scannable bearer token). Compare against how established products do it (WhatsApp Web / Signal desktop linking, OAuth device authorization grant RFC 8628).

## Acceptance Criteria
- [ ] ADR with Jari's decision on the flow and its threat model.
- [ ] Implementation per the ADR with gateway tests for expiry, single use and revocation, and a browser test of the phone sign-in.
