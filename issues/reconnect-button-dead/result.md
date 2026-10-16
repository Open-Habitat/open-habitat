# Reconnect and uncertain creation recovery

## Findings and fix

- `Yhdistä` called only the snapshot refresh. It never cancelled the event journal's pending probe/backoff. A snapshot at the same cursor deliberately does not reopen the stream, so manual reconnect could leave SSE disconnected. Explicit reconnect now fences the old transport callbacks, cancels the probe/timer and immediately reconnects at the last validated cursor, while also refreshing the snapshot and retained history. Stream-only loss has a connection warning without claiming HTTP writes are blocked.
- A failed creation left a session-storage guard with no release path. **Tarkista luonnin tulos**, **Yhdistä** and the explicit toolbar refresh now request a read-only recheck. Only successful snapshot AND conversation-list reads for the current identity release matching creation attempts. A failed read retains the guard. Pending creations, sends and continuations are not cleared. Creation is never automatically repeated; a committed conversation is discovered in the native list.
- `WorkspacePage` rendered its own `+` and then a `WorkspaceActions` that rendered another disabled `+`. Page actions now omit that second creation control, leaving one `+` and the `…` menu. Git remains available below the header.

Self-review caught reload-during-creation: an in-flight marker must remain recheckable after reload, but not while its original HTTP write is still pending. The attempt token persists in session storage; only the live pending-request set is in memory. Read responses compare the captured attempt value before clearing it, and the existing identity-generation fence protects abandoned logins.

## Synthetic evidence

All captures use invented lab homes and identities, never the live server. Adjacent HTML files are inert offline twins.

- [Before: uncertainty and duplicate buttons](before-uncertain.png) · [HTML](before-uncertain.html)
- [Before: snapshot outage](before-disconnected.png) · [HTML](before-disconnected.html)
- [After: uncertainty, explicit recheck and intended controls](after-uncertain.png) · [HTML](after-uncertain.html)
- [After: daemon HTTP restart and reconnect](after-reconnected.png) · [HTML](after-reconnected.html)

Lab: `OH_PORT_BASE=28400 scripts/lab.sh start`, scripted Chromium via `web/lab/session.mjs` and `snapshot`. An ordinary snapshot outage recovered even before the fix; the separate unchanged-cursor browser regression distinguishes snapshot-only refresh from actual event-stream reconnection.

The new `/fixture/daemon-restart` closes and reopens the actual synthetic Unix HTTP servers and replaces controller incarnations (optionally preserving the controller for a transport-only outage). Gateway sessions and invented native homes survive. This is real gateway/daemon HTTP handling with fake Pi, not a separate-UID, systemd, production-process or live-host restart claim.

## Validation

Final commands and outcomes recorded below after verification. Live-server recovery remains for the checks in `KOKEILTAVAA.md` after deployment.

On rebased implementation `f812daa4` (base `22535bc5`):

- `./scripts/test-web-fast.sh`: passed (format/lint/typecheck, unit and component tests).
- `OH_PORT_BASE=28400 ... ./scripts/test-focused.sh --area browser --spec reconnect-recovery.spec.ts`: 4/4 passed. Covers unchanged-cursor stream retry, actual Unix HTTP daemon restart, committed/lost creation reply, absent creation, failed list recheck, no automatic writes and working header menu.
- The same focused command for `resilience-states.spec.ts`: passed, including existing auth/recovery and accessibility checks.
- `--spec browser-conversation.spec.ts --tag 'lost create acknowledgement'`: passed; reloading alone still blocks duplicate creation.
- Baseline red check: replaced the six changed production recovery/header modules with `0a37a337` versions while retaining the new host restart fixture and browser tests. 3/4 cases failed: unchanged-cursor reconnect timed out waiting for SSE; both creation cases found the extra header button. Restoring the fix passed 4/4. The full daemon-incarnation restart alone already recovered in the baseline, so it is not claimed as a newly exposed failure.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed. Existing PNG evidence warnings do not invalidate issue metadata.

Captures were taken during development from the base revision with dirty implementation changes; their HTML headers name that base, not the final tested revision. The controls/layout are unchanged by the final pending-request hardening and rebase.

Full clean gate follows on the committed closing tree; its outcome is recorded in a subsequent evidence-only commit. No live server or personal profile was used.
