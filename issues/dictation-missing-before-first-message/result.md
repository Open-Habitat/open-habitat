# Result

The new-conversation view (`CreatingConversation`, also the worktree agent's
first-message view) now gives its composer the same `speech` object and csrf
as `BrowserConversation`, so the mic is there before the conversation exists.
Dictation ends into the composer's own draft setter, which keeps the start
page's goal chip, so dictated text and the goal's Aloita text are one draft;
that draft is the creation draft that `adoptCreation` hands to the created
conversation.

A dictation running when the creation reply arrives would have been cut off by
the swap to the created conversation. The composer now reports
`onDictating` (also while a send ends a dictation), and App keeps the
new-conversation view until it ends, then adopts the draft again and lets the
redirect happen.

Browser evidence: `web/tests/speech-input.spec.ts` — a new conversation
dictated while its creation reply is held, then shown with the dictated text
and sent; a worktree agent's first message dictated and sent as the creating
message. The hold test fails without the App change.

## Decisions for later review

- **Created conversation waits for a running dictation.** Alternatives: let
  the swap end the dictation and lose the unconfirmed text; or move the live
  engine across views. Waiting is the smallest change that loses nothing; the
  cost is that the view says "Uusi keskustelu" a little longer while the person
  speaks.
