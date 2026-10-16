# Result: sending before Pi runs

Round `design-system/prototypes/rounds/2026-10-16-jonolahetys/`. Build from the
repository root:

```
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-16-jonolahetys
```

The page is written to `design-system/prototypes/dist/2026-10-16-jonolahetys.html`.
`check.mjs` passes for desktop light, desktop dark and phone, with the new-conversation
`+` and the field clicked. The console is clean. A separate state walk
(rest, one queued, two queued, delivered, second queued behind a running turn, Stop
before Pi runs, failed start, retry), run for every direction and both entry points on
desktop and phone, also logged no errors. A selection is in `shots/`.

## What the lab showed first

- A stopped conversation opens with "Ei käynnissä" and "Vain luku" in the top bar, a
  "Vain luku · Tätä keskustelua ei voi ohjata selaimesta" bar in place of the field, and
  "Uusi keskustelu".
- A new conversation (`PendingConversation`) shows "Luodaan keskustelua…" with a
  disabled composer. Once created, the empty view has "Prosessiyhteys ei ole saatavilla"
  and "Spinoffien tilaa ei saada" above the field. Both are out of scope here; the
  fill-direction and strip round (`2026-10-16-tayttosuunta`) owns that area.

## Axis and directions

The axis is **where the sent but undelivered message waits, and how strongly it differs
from a delivered one.** The three directions use the same content, the same Stop, the
same order and the same failure behaviour.

1. **Kupla odottaa.** The message appears in the thread at once as a dashed, muted
   bubble whose head says "Odottaa Pi:tä". A second message says "Jonossa edellisen
   jälkeen", and once Pi runs it says "Lähtee, kun Pi on vastannut". When Pi takes a
   message, the bubble becomes an ordinary bubble with its time and a brief accent ring.
   *Decides:* the thread is the single place for your words, and the waiting state is
   visibly different.
2. **Jonossa kentän yllä.** The thread does not change until Pi takes the message. The
   waiting messages are listed in order in the library's queue box above the field
   ("Odottaa Pi:tä · 2"). On delivery, the row leaves the list and a normal bubble drops
   into the thread.
   *Decides:* the thread shows only what Pi has received, and anything waiting lives in
   the same place as the existing Ohjaa/Työn jälkeen queue.
3. **Kuittimerkki.** The bubble looks sent from the first moment. Only a small clock and
   "Jonossa" in its head differ. On delivery, the mark turns into "✓ Pi sai viestin" for
   about two seconds, then shows the time.
   *Decides:* sending feels immediate, as in a chat app, and the not-yet state is a quiet
   detail.

Shared by all three:

- **Field and send.** The field is never disabled, and nothing tells the person that the
  Pi process is starting.
- **Top bar.** While a message waits, the bar shows one word, "Lähetetään". A failed
  start shows "Ei lähtenyt". The new conversation shows no "Luodaan keskustelua" text.
- **Stop.** The Stop button is shown below the field while a message waits, in the same
  place it has while Pi works. Pressing it before Pi runs sends nothing, does not start
  Pi, and moves the waiting messages back into the field, in order and ahead of any
  draft. A toast confirms this. Stop during the first turn ends the turn and gives back
  the second, still-waiting message the same way.
- **Second message.** Pi takes only the first message. The rest wait and go one at a
  time after each turn ends, which equals Pi's follow-up.
- **Failed start.** Each waiting message is marked "Ei lähtenyt". The view says "Pi ei
  käynnistynyt. Viesti(t) on tallessa." and offers **Yritä uudelleen** (start again and
  keep the queue) and **Muokkaa** (return the text to the field). In direction 3 these
  are links inside the last bubble. Sending a new message after a failure also retries.

Page bar controls: "Tilanne" switches between the stopped conversation and a new
conversation in the empty `muistiinpanot` workspace. "Käynnistys epäonnistuu" makes the
next start fail, and the retry then succeeds. "Esitä" types and sends both messages.
"Hidastettu" stretches the 5-second start.

## Host facts the view assumes

- **Queued message.** The browser sends `agent.message` (or `agent.resume` / `agent.start`
  carrying the message) with its `client_command_id`. "Queued" is the daemon receipt
  `acceptance: accepted, execution: not_started|running` for that id. The bubble or row
  is keyed by the `client_command_id`, so a reconnect redraws the same pending item and
  never sends it twice.
- **Delivered.** Delivery is the moment the message appears as a user entry in Pi's
  native history or event stream (the persisted user entry supersedes the pending
  item). The receipt alone does not count, because a receipt only says that the daemon
  holds the message.
- **Order behind the first.** The daemon holds every message sent before Pi is ready, in
  order. When Pi is ready, it hands Pi the first as the prompt and the others as Pi
  follow-ups. After that the existing `queue.changed` follow_up list is the source of
  truth. A message is never resent after a restart unless its receipt says
  `not_started`.
- **Stop before Pi runs.** This needs a command, for example `agent.queue.clear` widened
  to pre-start items or a cancel of the pending command, that removes the held messages
  and cancels the start. Its receipt returns the removed texts (as `removed_queue` does
  today), so the browser can put exactly them back into the field.
- **Start failure.** `execution: failed` with a `problem` on the start/resume command, and
  every held message still listed as not delivered. Retrying reuses the same message
  ids. The view shows only the plain "Pi ei käynnistynyt"; the problem's detail would go
  in Tiedot, not the thread.
- **New conversation.** `agent.start` returns the agent id quickly enough to
  route to the conversation. Pi readiness is separate and can lag behind.

## Library proposals (not made; overridden inside the round)

- `lib/composer.js`: `working()` is tied to conversation `c1`. A queued-send state needs
  the composer to know "a message waits" separately from "Pi works", so that Stop shows
  in both.
- `lib/app.js`: the empty new-conversation text says "Pi käynnistyy, kun lähetät
  ensimmäisen viestin". With this behaviour it should say nothing about Pi. The round
  shows "Otsikko syntyy keskustelusta." only.
- The chosen direction's pending markup and its CSS (`q-wait`/`q-panel`/`q-tick`) would
  move into `lib/composer.*` or `lib/pieces.js`.

## Questions for Jari

1. Which direction: Kupla odottaa, Jonossa kentän yllä, or Kuittimerkki?
2. Is it right for Stop before Pi runs to return the messages to the field? The
   alternative is to drop them, with a Palauta undo.
3. Should a second message sent during the wait go after the first turn (Pi follow-up,
   as drawn), or be joined with the first into one prompt?
4. Is "Lähetetään" in the top bar while the message waits too much, or should the bar
   show nothing until Pi works?
