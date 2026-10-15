---
created: 2026-10-15
updated: 2026-10-15
type: bug
reporter: jari
status: open
priority: high
lane: reauth
collision: [internal/daemon, web/src/app/GitHubOnboarding.tsx]
---

# New conversation stuck and continue leaves a stale, repeated state

Jari, pilot.65 on the test server (2026-10-15), with his own account:

1. **A new conversation got stuck.** Jari suspects a Pi provider (OpenAI) error, possibly an expired login that needs re-authentication.
2. **"Jatka keskustelua" did not properly activate an older conversation.** The result is shown in `stale.png` in this folder: a "Keskustelun tila vanhentui" notice, a centred "Tarkista keskustelun tila" link, a disabled composer with the hint "Tila on vanhentunut. Tarkista keskustelun tila ennen lähettämistä.", and a Lähetä button misaligned with the field (its baseline below the field). Jari saw the same messages repeated several times.

Jari's decision: if the cause is an expired or failed provider login, **implement the re-login UI and flow now**, using this situation as the case. The user must see that Pi cannot reach its provider because the login expired or failed, and get a clear way to sign in again (reusing the existing Pi onboarding device or OAuth flow). Afterwards the conversation continues without losing the draft.

Investigate the actual cause first. Read the test server's daemon and Pi state for Jari's user, read-only, through the documented operator access (Fleetrepo `infra/open-habitat-test/`). The cause may also be a host bug in the continuation or status path. Fix what is found.

## Acceptance Criteria
- [ ] Root cause recorded in result.md with evidence (redacted: no tokens, no private conversation content).
- [ ] If auth: an expired or invalid provider login is detected and shown as such, with a working re-login flow (Go tests plus a browser journey with a fixture that expires the credential).
- [ ] "Jatka keskustelua" activates a resumable conversation, or explains truthfully once why not. No repeated notices. Composer and Lähetä are aligned (element rectangles).
- [ ] result.md has a "Decisions for later review" section.
