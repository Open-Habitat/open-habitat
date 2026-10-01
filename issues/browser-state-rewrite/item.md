---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@architecture-built-on-caution', '@session-mask-on-every-refresh', '@conversation-open-flicker', '@uncertain-flash-on-send']
lane: caution-removal
lane_seq: 60
blocked_by: ['@daemon-drop-status-stream', '@drop-conversation-lease']
closed: 2026-10-01
closed_by: claude
---

# Rewrite the browser state model to the check-once shape

## Goal

Step 6 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan, done as one rewrite of the browser state model to the target shape in Part 2, not as a sequence of removals. Closes @session-mask-on-every-refresh, @conversation-open-flicker and @uncertain-flash-on-send.

## Target shape

The browser loads once: session, Pi status (once per page), snapshot. It opens the events stream from the snapshot cursor and keeps it open. On an event it updates in place; on a gap, `snapshot.invalidated` or a 409 it fetches a new snapshot and the affected history, without a mask. Opening a conversation fetches status and history in parallel and renders once. A write sends the request; the result is pending until the server answers, then accepted, rejected, or uncertain only if the request itself failed after being sent. A 401 is the only trigger for the login view; a changed `web_identity_id` in any snapshot is the only trigger for a state reset (the `authenticated` reducer). A transport failure shows the stale banner over unchanged content and retries on `online` and on an explicit button. No focus, blur or visibility listener.

## Scope

- `App.tsx`: remove the `verifying` mask, focus/blur/visibility listeners, `retain`/`stale`, 10 s timeout, `sessionBinding`, `identityEpoch`, `loginGeneration`, `captureEditor`, `conversationPlace`, the four `sessionStorage` purges (B1 to B4). Keep the first-load Pi check (B5) and the reducer reset (B17). Key the tree on `web_identity_id`. Mount a conversation once per id, not per `location.search`.
- `BrowserConversation.tsx`: drop `sessionCSRF`/`verify` pre-checks (B6), `streamError`/probe/"Live-yhteys katkesi" gating of writes (B8), the status stream and 3 s poll (B12), the session/list mount step (B7); one loader for status and history on open (B13); pending rendered as pending, "uncertain" only after a sent request fails, until an authoritative outcome resolves it (B9); storage keys by identity and conversation (B10); history read on open and on `history.entry` or invalidation (B11); continue shows the server's answer (B14). One slow fallback poll (starting at 60 s) only while the events stream is down.
- Keep the strict parsers (B16).
- Record in `docs/ui.md` when the user sees a loading state, a stale banner or an error, and that there is no mask.

## Result to establish

Opening a conversation has one coherent loading transition, with no empty
history or partial status phase flashing before the loaded view. Normal sends
show pending and then the known outcome, without an uncertain notice during
the request. A lost reply stays uncertain until resolved without duplicating
the command. Background refreshes and tab returns leave the view mounted.

Browser coverage includes 401 to login, a changed snapshot identity resetting
the view, and late old-identity replies not repopulating it. Preserve the
first-use and GitHub journeys and journal gap recovery. An idle-tab lab
measurement shows one healthy events stream and no periodic status or session
reads; returning to the tab creates no refresh burst.

The three linked defects are verified on the test server and the result states
the tested version and evidence. Jari can review visual evidence on his own
schedule. Responsibility-based file splitting belongs to step 7; there is no
line-count threshold for completing this rewrite.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

## Lab verification and resolution (2026-10-01)

Implemented on `063f959`, review repairs `94a362b`, and lab assertion correction `f5f0a6f`. Synthetic host, fake Pi and Chromium; no test-server deployment in this worker.

- Browser: one coherent status/history loading transition; no empty-conversation flash before the loaded view. Normal sends render pending and then the server answer; the ambiguous notice appears only on lost reply and a persisted marker reconciles on quiet reload without replaying the write. A queue-clear 401 enters login.
- Identity and connectivity: session 401 enters login; changing the snapshot identity resets stale UI and fetches a new CSRF token; delayed old-identity replies do not repopulate it. Transport errors retain visible content under a stale banner; explicit retry reconnects. Journal gap and expired catalog cursor recovery are covered by host-backed browser cases. First-use GitHub chooser and Pi restart journeys pass.
- Idle tab: with one healthy event stream open, advancing the synthetic browser clock 60 seconds and returning focus triggered zero session, conversation-status, snapshot or events requests (after initial settlement). No focus-triggered mask or refresh burst.
- Automated checks: fast web gate and focused browser/lab journeys passed. Final committed implementation `f5f0a6f` passed `TMPDIR=/var/tmp/nah-browser-rewrite NAH_PORT_BASE=14600 ./scripts/ci-local.sh --clean --json` (110 browser + 13 lab cases; web, Go, contracts, packaging, doctor). The first clean run found five onboarding/resilience failures and the second found one stale lab assertion after 110 Chromium cases passed; all were corrected before the final run.
- Review: independent security/correctness finder reported five reachable in-scope defects against `063f959`; independently checked, all fixed. Assessment at `history/assessment-browser-state-rewrite.{json,md}` is ignored local scratch, so this summary stands alone. No new issue was justified.

This is lab evidence, not production or separate-kernel-UID proof. The three linked user-visible reports still need a visual check on the **test server with the next release**; the conductor owns that follow-up. No deployment was attempted here.

## Acceptance Criteria

- [x] Synthetic browser verifies a single coherent open, pending/uncertain write outcomes, changed-identity reset and late-reply isolation, 401 login, journal recovery, first-use onboarding and idle request counts.
- [x] Final committed implementation passes the clean JSON CI gate.
- [x] The independent security/correctness findings were assessed and resolved; next-release test-server check is explicitly handed off.
