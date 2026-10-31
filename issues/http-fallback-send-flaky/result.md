# Result: HTTP fallback send spec counted zero sends under load

Test-only fix in `web/tests/browser-conversation.spec.ts`. The product is
unchanged.

## Cause

The case clicks *Lähetä* as soon as the new conversation's editor is
enabled. It does not wait for the conversation to exist. Until creation
answers, the view is `PendingConversation`. Its send keeps the message as a
held message (`heldMessages.ts`), draws it, and empties the field at once.
The POST to `/send` goes out only after the conversation is created. Under
suite load creation is slow, so the editor emptied before any `/send`
request existed, and the synchronous `expect(sends).toBe(1)` read 0. The
neighbouring send case first waits for the `conversation=pi:` URL, so it
always sends on the ready path.

The send-path change from the same day (spent command IDs answered as
admission) is not involved.

## Fix

The case now waits for the `/send` response and checks that it succeeded
before counting. Exactly one send is still required.

## Evidence

On Birch, `OH_PORT_BASE=9550`, `OH_BROWSER_WORKERS=2`:

- A temporary probe delayed the create POST by 3 s. The editor emptied with
  0 sends while the URL was still `conversation=new`, and exactly one
  `/send` followed after creation. This reproduces the gate failure
  deterministically.
- The fixed case passed 3/3 with the same 3 s create delay.
- Load: a `timeout`-bounded loop of `browser-conversation.spec.ts` (4
  workers, `OH_PORT_BASE=9650`, its own `--output`) plus four `timeout`-bounded
  CPU burners, load average 6–8.5. The fixed case passed 10/10 and again
  10/10. Before the fix, 15 repeats under the same load did not happen to
  hit the window, so the probe is the reproduction.
- `./scripts/test-focused.sh --area web` passed. The whole
  `browser-conversation.spec.ts` passed 75/75. `biome check` on the spec
  passed.

Review: focused self-review. Only the test changed.

## Decisions for later review

- **Emptying the field before the POST is intended, not a race.** The text
  does not disappear: it is drawn as a held message and given back on
  *Muokkaa* or on refusal, and it is posted exactly once after creation. An
  alternative would keep the text in the editor until the POST is made.
  That would contradict the held-message design and the ready path's "the
  text leaves the field at once" rule (`ConversationActions.submit`), so I
  did not change it.
