---
created: 2026-11-04
updated: 2026-11-04
type: bug
reporter: jari
status: open
priority: high
lane: ai-sign-in
lane_seq: 1
preparation: ready
---

# An expired AI provider sign-in shows as a finished answer

## Description

Jari 4.11. (screenshot, a conversation on Birch, Anthropic/Claude
subscription sign-in had expired): after he sent a message the reply card
said **Vastaus valmis** with the text "Failed to authenticate: OAuth session
expired and could not be refreshed". Nothing told him what to do; he found
the fix himself by going to Settings and signing in again, after which it
worked.

Two parts:

1. **Defect (fix directly):** a turn that failed is drawn as a finished
   answer. Habitat already draws `stop_reason: "error"` as failed
   (`HistoryView.tsx`), and the rail treats a turn that ended in an error as
   a failure, so this one did not reach that path: find out what Pi / the
   Claude bridge actually wrote (stop reason, error field, message text) in
   the live stream and in history, and make an authentication failure show
   as a failed turn in both, with no claim that the answer is ready.
2. **What the person is told (prototype first):** an expired or missing AI
   sign-in should be said like the GitHub expired-login warning
   (`github-connection-warning`: above the composer and app-wide, one
   sign-in that returns to the conversation), with the message kept so it
   can be sent again after signing in. That presentation is
   `proto-ai-sign-in-expired`.

## Acceptance Criteria

- [ ] An authentication failure is never shown as *Vastaus valmis*; live and after reload it shows as a failed turn; a test with the exact provider error reproduces the old wrong state and passes after.

## Also (Jari 4.11.)

The same conversation stayed in **Käynnissä** in the rail afterwards,
although nothing was running (a small marker on its row). Likely the same
root: the failed turn was not recognised as ended-in-error, so the rail's
state for it is wrong too. Verify and fix it in the same unit: after an
authentication failure the conversation leaves Käynnissä (it is a failed
turn, shown as the rail shows other failures).
