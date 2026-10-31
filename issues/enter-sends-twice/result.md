# Result

Evidence: Pi's session `467240ec` and the daemon journal on Birch (pilot.16),
11:46–11:48 local (09:46–09:48Z).

## (1) "Hylätty · Tila muuttui" was a steer that raced the end of the turn

Pi wrote the turn's final answer at 09:46:09.392Z. The page still showed the
agent working, so Enter sent `POST …/steer`. It reached the daemon at
09:46:09.640Z, 250 ms later, and got 409 `control_uncertain`: the daemon only
admits a steer while Pi's state is `accepted`. The page put the text back in
the field as refused. Jari pressed Enter again and the text went as a
plain `send` (200) at 09:46:24.074Z, the single user entry in Pi's session.
So no delivered message was shown as refused. The refused one was in fact
not delivered, and `send-rejected-after-delivery` (a repeated command ID)
had nothing to do with it. Main had the same refusal, with only better
wording.

Fix: on the browser route, a steer or follow-up that finds Pi live and idle
(not running a turn, not starting or waking) is admitted as a new prompt,
as Pi's own prompt would take it after the turn. The page needs no change:
it already reads the command's receipt and retires its queued drawing when
native history shows the text. The agent CLI (`agent message create
--delivery steer`) still gets 409. An agent that chose steering explicitly
is told the turn has ended.

## (2) The duplicate *Ohjaus* rows were only drawn twice

Each steer was one POST (journal: 09:46:51.772, 09:47:08.287, 09:47:14.192Z,
all 200), and Pi got each once. The page draws Pi's queue plus its own queued
messages that it does not find in Pi's queue, matching them by text. Pi queues
the text with the host's `Attachment path: …` lines, which the daemon adds for
each attachment. The status `queue` and the `queue.changed` event passed that
text on unchanged, so a steer with a screenshot never matched and was drawn
twice: once from Pi's queue and once as the tab's own. The clear reply
(`removed_queue`) already mapped texts back with `writtenText`. Status and
the event now do the same. Pi's text is kept internally (the unanswered-queue
tracking matches it against Pi's events). The Enter key itself dispatches
once: the composer ignores IME composition, prevents the default, and the
journal shows one POST per press.

## Proof

- `@browser-conversation one Enter queues a steer with an attachment once`:
  pastes an image, steers with Enter, samples the queue card on every frame.
  Without the daemon change it sees 2 rows (the card showed Pi's expanded
  text with the path line); with it, 1 row and exactly one POST.
- `@browser-conversation a steer that arrives after the turn ended is sent,
  not refused`: holds the steer POST until status says the turn ended. Without
  the change Pi never gets the message; with it the reply arrives, the text
  is shown once, and there is no refusal or receipt notice.
- `TestBrowserSteerAfterTurnEndStartsTurn`: browser route prompts an idle
  Pi; explicit route gets 409; a run still active is not prompted.
- `go test ./internal/daemon` passes, along with the existing steer, queue
  clear and double-send specs.

## Decisions for later review

- **A late browser steer becomes a new turn rather than a refusal.**
  Alternatives: keep 409 and have the page retry as send (a second round
  trip, and the page's view of Pi's state is what was stale), or turn it
  into a send in the page before posting (the same race, only earlier).
  The person's intent is "deliver this". Only the daemon sees Pi's state
  without a race.
- **The agent CLI keeps the refusal.** Its caller chose the delivery
  explicitly and can act on the answer. The browser's steer is the page's
  guess on the person's behalf.
- **Queue texts are mapped at the output, not stored written.** The
  unanswered-queue tracking compares Pi's own texts with Pi's events.

## Review

Independent `/llm-review` (finder gpt-6-astra: no findings; verifier
claude-fable-5-1, one focused question on session state) and
`/assess-findings`. Applied: the conversion also requires that no Pi run is
active (`rejected` can coexist with a native wake-up run), with a test case.
Dropped: a send admitted in the instant between `agent_settled` and the
drain's settlement record skips that turn's settlement event and push. This
predates the change for direct sends, is rare, and the person has just
pressed Enter on the page.
