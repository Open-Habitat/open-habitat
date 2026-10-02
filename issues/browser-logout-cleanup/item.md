---
created: 2026-10-02
updated: 2026-10-02
type: task
reporter: jari
status: open
priority: normal
related: ['@one-browser-event-stream', '@recent-conversation-windows']
lane: client-history
lane_seq: 40
collision: [web/src/app/]
---

# Clean up browser streams and state on logout

## Goal

Logging out stops the browser's event listeners and clears the user's
in-memory state, including retained conversation views. Returning to the sign-in
screen or signing in as another person starts with a clean browser state.

## Context and approach

`web/src/app/App.tsx` already handles logout, clears identity and sends the
logout request. Build on that lifecycle and inspect the existing cleanup before
adding anything. Give logout one place to dispose of active streams, pending
reads and user-specific state. Late responses or queued events from the old
session must not restore content after cleanup.

@one-browser-event-stream and @recent-conversation-windows introduce shared
connection and retained-view owners. Integrate their disposal with logout here;
those features should expose cleanup for the session lifecycle to call.
Detected session expiry and identity replacement should use the same cleanup.

Preserve truthful failure handling for the server logout request: stopping local
listeners does not itself end the server session. This work concerns browser
logout, not the operator's targeted-revocation mechanism in ADR 0006.

## Acceptance Criteria

- [ ] Logging out closes event connections and prevents reconnects under the old session.
- [ ] User-specific browser state, including retained histories and live output, is cleared; late events and responses cannot restore it.
- [ ] Session expiry and switching to another identity use the same cleanup, and a subsequent login works normally.
- [ ] Browser tests cover logout during a running turn and pending history read, a later login, and a failed server logout request. Validation follows TESTING.md.
