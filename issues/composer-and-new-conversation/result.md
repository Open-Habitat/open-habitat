# Result

All five points are implemented together with `lazy-resume-on-send`, which
uses the same mechanism. Run `01m52r9c2zbw0gw1a0j9egcrqh` completed the work that
run `01m52qdasz0zmd2rx0bmfbd310` left after points 1 and 2 (commit 046d9259).

## What changed

1. **Composer colour** and 2. **send arrow**: commit 046d9259 (shared field
   surface and icon presentation); rechecked here by `composer-geometry.spec.ts`
   4/4 with the creation field now enabled.
3. **Field usable while a conversation is created.** The daemon replies to
   creation as soon as the Pi child exists; it no longer waits up to fifteen
   seconds for Pi's `get_state`. Messages sent before Pi is ready are held by the
   daemon under their command IDs, drawn as dashed "Odottaa Pi:tä" bubbles, and
   reach Pi joined into one prompt. Messages written in the moment before the
   conversation has an ID wait in the tab and are posted in order once it
   exists. Stop below the field returns exactly the waiting texts; a failed
   start keeps them with **Yritä uudelleen** and **Muokkaa**. No creation status,
   top-bar state or Pi-start text is shown. The contract is
   `contracts/v1/pi-held.schema.json`; the architecture is in
   `docs/architecture/conversations.md` ("Sending before Pi runs") and
   ADR 0020.
4. **Notices in a fresh conversation.** "Tapahtumia jäi väliin" appears only
   while a turn is live (only the live tail can miss events; settled history is
   read natively). "Spinoffien tilaa ei saada" appears only when spinoffs are
   known. The process row that only says "Pi ei ole käynnissä" is hidden.
5. **Luo työtila** gives the new workspace one conversation with focus in its
   field, unless the person has moved elsewhere before the workspace appears.

## Live cause of the slow "Luodaan keskustelua"

The test guest's journals (read as root over the pinned route, no conversation
content) contain only unit start/stop and `service_ready` events: neither the
gateway nor the daemon logs request timing, so the live delay could not be
measured there. The cause is therefore source-level: creation blocked on Pi's
initial `get_state` (fifteen-second budget) after launch, plus catalog
validation when a model was chosen. `lab-slow-creation.spec.ts` now asserts that
with a six-second Pi start the creation reply arrives in under four seconds and
the field is usable throughout.

## Evidence

Synthetic, host-backed (real gateway, daemon controller and fake Pi, same UID);
not live-host or distinct-UID evidence.

- `web/tests/queued-send.spec.ts` (8): joined prompt while creating with the
  POST held (field focused, two bubbles, one native prompt); failed start with
  retry delivering once; reload while held draws once and posts once; fresh
  conversation shows neither notice; Luo työtila focuses the new conversation;
  plus the lazy-resume cases listed in that issue.
- `new-conversation-placeholder.spec.ts`, `lab-slow-creation.spec.ts`,
  `composer-geometry.spec.ts`, `browser-conversation.spec.ts`,
  `lab-conversation.spec.ts` updated for the enabled field.
- Go: `internal/daemon/held_linux_test.go` (join, restart, cancel, failed start,
  terminal refusal, joined receipts on Pi death, held before a direct send).
- Final runs are listed in `../lazy-resume-on-send/result.md`.

## Prototype comparison

`shots/` holds paired captures from `capture.mjs`: `lab-<state>-<width>-<theme>`
(AVIF + offline HTML) and `proto-<state>-<width>-<theme>` from round
`2026-10-16-jonolahetys` direction 1, for `new-waiting`, `stopped`,
`stopped-waiting`, `stop-returned` and `failed`, at 1440 and 390 px in light and
dark. Same in both: the message appears at once as a dashed, muted bubble with
"Odottaa Pi:tä" in its head; the field stays usable; Stop sits below the field
while a message waits and returns the text to the field; a failed start marks
the bubble "Ei lähtenyt" and offers a primary retry and Muokkaa on one line.

Deviations, each deliberate:

- **No top-bar state** while waiting or after a failed start (the round showed
  "Lähetetään" and "Ei lähtenyt"): Jari's decision 4.
- **Every waiting bubble says "Odottaa Pi:tä".** The round's "Jonossa edellisen
  jälkeen" and "Lähtee, kun Pi on vastannut" described one-by-one delivery;
  messages are now joined (decision 3).
- **Delivery shows one bubble.** Pi receives one prompt, so its native history
  has one user entry with both texts; the round's per-message accent ring is
  not drawn.
- **Stop confirmation is a short status line** under the conversation for six
  seconds instead of a toast; production has no toast component.
- **Empty new conversation** shows the production "Otsikko syntyy
  keskustelusta." and the composer's model pill; the round's workspace-name
  lead line is not added.
- Prototype content (long Status-skripti history, recap card, real model chip)
  is richer than the synthetic lab's fake-Pi answers; the comparison is of the
  waiting states, not of the surrounding content.

## Decisions for later review

- Messages written before a new conversation has an ID wait in the tab's
  session storage and are posted once the ID exists. The daemon owns a message
  from its first post; before that there is nothing for the daemon to own, and
  creation now takes milliseconds.
- Stop before Pi runs in a new conversation takes the messages back but lets
  the conversation's own Pi start continue; in a stopped conversation it stops
  the Pi started for them.
- The joined text uses a blank line between messages and shares Pi's 64 KiB
  prompt limit; a message that would exceed it is refused and returned.
- Stopped browser conversations keep the sidebar's existing "not running"
  presentation rather than becoming "Odottaa sinua", so the home page's open-work
  sections are not filled with every past browser conversation.
- The new workspace's conversation is started only if the person stays where
  they created the workspace, for up to a minute.
- A start failure shows only "Pi ei käynnistynyt"; the fixed `start_problem`
  code is in the status, not in the thread.
