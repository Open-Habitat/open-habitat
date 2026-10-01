---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: high
related: ['@architecture-built-on-caution', '@session-mask-on-every-refresh', '@conversation-open-flicker', '@uncertain-flash-on-send']
lane: caution-removal
lane_seq: 60
blocked_by: ['@daemon-drop-status-stream', '@drop-conversation-lease']
---

# Rewrite the browser state model to the check-once shape

## Goal

Step 6 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan, done as one rewrite of the browser state model to the target shape in Part 2, not as a sequence of removals. Closes @session-mask-on-every-refresh, @conversation-open-flicker and @uncertain-flash-on-send.

## Target shape

The browser loads once: session, Pi status (once per page), snapshot. It opens the events stream from the snapshot cursor and keeps it open. On an event it updates in place; on a gap, `snapshot.invalidated` or a 409 it fetches a new snapshot and the affected history, without a mask. Opening a conversation fetches status and history in parallel and renders once. A write sends the request; the result is pending until the server answers, then accepted, rejected, or uncertain only if the request itself failed after being sent. A 401 is the only trigger for the login view; a changed `web_identity_id` in any snapshot is the only trigger for a state reset (the `authenticated` reducer). A transport failure shows the stale banner over unchanged content and retries on `online` and on an explicit button. No focus, blur or visibility listener.

## Scope

- `App.tsx`: remove the `verifying` mask, focus/blur/visibility listeners, `retain`/`stale`, 10 s timeout, `sessionBinding`, `identityEpoch`, `loginGeneration`, `captureEditor`, `conversationPlace`, the four `sessionStorage` purges (B1 to B4). Keep the first-load Pi check (B5) and the reducer reset (B17). Key the tree on `web_identity_id`. Mount a conversation once per id, not per `location.search`.
- `BrowserConversation.tsx`: drop `sessionCSRF`/`verify` pre-checks (B6), `streamError`/probe/"Live-yhteys katkesi" gating of writes (B8), the status stream and 3 s poll (B12), the session/list mount step (B7); one loader for status and history on open (B13); pending rendered as pending, "uncertain" only after a sent request fails and then it stays (B9); storage keys by identity and conversation (B10); history read on open and on `history.entry` or invalidation (B11); continue shows the server's answer (B14). One slow fallback poll (60 s) only while the events stream is down.
- Keep the strict parsers (B16).
- Record in `docs/ui.md` when the user sees a loading state, a stale banner or an error, and that there is no mask.

## Acceptance Criteria

- [ ] `web/tests/browser-conversation.spec.ts` rewritten: no `.ah-identity-check` ever renders; a conversation opens with one render; a normal send shows no uncertain notice; 401 leads to the login card; a snapshot with a different identity resets the view (the keep-conversation-view-stable "new subject" case kept as regression).
- [ ] Lab measurement: an idle open conversation tab makes no requests other than the events stream and its heartbeats; a tab return makes no request.
- [ ] `App.tsx` and `BrowserConversation.tsx` each under 600 lines before @split-large-files.
- [ ] The three linked bugs reproduce no longer on the test server (pilot release, Jari confirms).
