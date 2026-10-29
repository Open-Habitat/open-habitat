# Result: sent message appears late

## Cause, measured

The browser drew the person's text in the conversation only from Pi's own
record of it. That record reaches the page in this order:

1. the POST, then a status read that shows Pi's acknowledgement. Pi
   acknowledges a `prompt` only after its preflight (input handlers, auth
   check, a possible compaction, `before_agent_start` extensions);
2. Pi writes the user message to its JSONL (`message_end`, role user);
3. the daemon announces it as `snapshot.invalidated`, debounced by 250 ms
   (`eventJournal.invalidateNative`);
4. the page reads status again and then native history (two more round
   trips, plus the daemon's read of the whole session file).

For a direct send the text stayed in the field until step 1 and then was
nowhere until step 4. A steering message moved to Pi's queue card after
step 1. When Pi delivered it at its next step, it left the card and was
again nowhere until steps 3–4.

Measured on the synthetic host (fake Pi, loopback, no network latency):

| Case | Before | After |
| --- | --- | --- |
| Direct send, Pi idle | text in field until ack, in conversation at 75 ms | in conversation at the press |
| Steer while Pi works | in the card at 71 ms; after delivery **82 frames (~1.4 s) with the text nowhere** | in the card at the press, stays until Pi's record shows it; no frame without it |

On Birch every step 1–4 adds a browser round trip and Pi's real preflight,
so "up to a second" fits. The delay is in our echo path, not in Pi. Pi's
preflight is native and stays, but it no longer delays what the person sees.

## What landed

- `web/src/app/sentMessages.ts` keeps the text in exactly one place:
  - **Direct send:** the field clears at the press and the text is drawn as the
    person's message (`data-delivery="pending"`, marked *Lähetetään* until Pi
    acknowledges). Pi's message replaces it when native history shows a newer
    user entry than those present at the press. The text does not have to
    match, so a skill invocation or attachment expansion replaces it too.
  - **Steer or follow-up:** the field clears at the press and the text joins
    Pi's queue card, merged with Pi's own queue (matched one by one, so equal
    texts are not lost). A message Pi has delivered stays in the card until
    native history shows it, with a 10 s grace if its text never matches. One
    native entry accounts for one message, and never for an unacknowledged one.
  - **Refused or unknown outcome:** the text goes back to the field, once
    per command. Only text given back that way is cleared again if the send
    later proves accepted (it used to be any equal draft).
- `useConversation` and `ConversationActions` carry the command and kind on
  the send observation. The old pending status line under the conversation
  shows only when the kind is unknown (after a reload).

## Evidence

- `web/tests/browser-conversation.spec.ts`: *a sent message is shown at once
  and never twice* (history reads held, so the message is drawn while none can
  arrive, and every animation frame from the press on has the text in view
  exactly once). *A steering message stays in view until Pi's record shows it*
  samples every frame the same way. Both fail on the code before this change:
  the steer case had 82 frames without the text, the send case had frames
  without it while history was held.
- `web/src/app/sentMessages.test.ts`: arrival despite a changed text, an
  older page does not count as arrival, equal queued texts, delivery linger
  and grace, an unacknowledged message never dropped.
- Updated expectations: the pending send is now the drawn message (three
  `browser-conversation` cases). `lab-composer-area` waits for the queue
  command's reply before keyboard and Stop checks, because the card now shows
  the message before that reply.
- Runs on Birch: `test-focused.sh --area web` (881 passed);
  `browser-conversation` 74/74, `queued-send` 13/13, `attachments` 1/1,
  `start-here` 4/4; lab `lab-composer-area` 10/10 (twice),
  `lab-conversation` 14/14, `lab-skill-invocation` 6/6.

## Decisions for later review

- **The field clears at the press, not at Pi's acknowledgement.**
  Alternative: keep the text in the field until acknowledged, as before,
  and draw nothing earlier. Chosen because a text in both the field and the
  conversation reads as unsent or duplicated. The text returns to the field
  whenever the outcome is refused or unknown, so the old guarantee (a send
  whose outcome is not known is never lost) holds.
- **A delivered steering message waits in Pi's queue card until native
  history shows it**, for at most 10 s. Alternatives: drop it from the card at
  delivery (the old gap), or draw it in the conversation at delivery. Drawing
  it in the conversation would place it after the running turn's live tail,
  where Pi's history will not put it, and it would then jump. A card a fraction
  of a second behind Pi is the smaller error.
- **No daemon change.** Publishing Pi's user `message_start` text as a live
  event, or dropping the 250 ms debounce for user messages, would shorten
  steps 3–4. Both change the journal contract and the daemon's rule that RPC
  frames do not become history. The browser alone now covers the gap.
- **Esc right after Alt+Enter**, while the queue command is still on its way,
  does nothing, as before. The difference is that the card now already shows
  the message. Not changed.
