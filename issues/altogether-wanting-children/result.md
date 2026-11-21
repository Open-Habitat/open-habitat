# Result

Two causes, one in the product and one in the spec.

## Product: a write pressed during a routine status re-read was refused

The store marks a conversation's status stale whenever an event starts a
fresh read. For the open conversation this happens when its own command is
acknowledged as pending, and after a daemon restart. While the status was
stale, `BrowserConversation` counted this as a refusal (`sendRefused`). So a
send, steer or queue pressed during the 15–60 ms read was refused with "status
unknown" and the text stayed in the field. That is the behaviour Jari reported
on 31.10. (a steer pressed as a turn ended was refused). It caused the
failures of:

- `a steer that arrives after the turn ended is sent, not refused`: Enter
  took nothing, and the trace shows no steer request at all;
- `queue-clear 401 reaches login` and `a stale working view cannot strand an
  unsent queued draft`: their Alt+Enter was refused, so the queue card never
  appeared.

Fix: the store now also records `lostStatuses`, which are stale statuses whose
re-read failed. A new read clears the mark, and so does any applied status. A
stale status with a read in flight now goes through `sendWhenReady`: the
message is kept, as it already is while the view opens, and it goes the way the
send button would send it once the read lands. Only a lost status is still a
refusal, and the composer gives the text back and says why. A unit test in
`conversationStore.test.tsx` covers the stale, lost, and read-again states.

## Spec: fixtures installed before the state they depend on

- `logout fences a pending status read…` held **every** status read from
  before the recheck button was shown. When the turn settled inside that
  window, its read was held. That marked the status stale, which hides the
  recheck button until the held read returns, and the case only released the
  read later. So the case waited on itself.
- `malformed host status fails closed…` answered **every** status read with the
  malformed body from before `refreshConversation`. A background read answered
  that way replaced the opened view, so `readyConversation` never found the
  header's archive/close control.

Both cases now use `watchRecheck`. A capture-phase `pointerdown` listener
records the press on the recheck button, and the route acts only on reads
issued after it. Background reads pass untouched. A first version armed the
route just before the click, and it failed 1 of 100: the remaining
milliseconds-wide window still lost the race once.

## Evidence

`OH_BROWSER_WORKERS=2`, `OH_REPLY_DELAY_MS=60`, `--workers 2`, the five cases
selected with `--grep`:

| run | before | after |
| --- | --- | --- |
| `--repeat-each 6` | 23/30 (logout 3, steer 2, malformed 1, queue-clear 1 failed) | 30/30 |
| `--repeat-each 20` | — | 100/100 (final version), 99/100 (arm-before-click version) |
| `--repeat-each 20`, `OH_CPU_THROTTLE=4` | — | 100/100 (with the arm-before-click version of the logout and malformed fixtures) |

Logs are in `/var/tmp/agent-keep/test-stability-v4b6/i2-*.log`.

## Decisions for later review

- **A message pressed while the status is being re-read waits and is sent
  afterwards, instead of being refused.** The alternatives were to keep
  refusing it (the 31.10. complaint) or to send it at once on the stale
  knowledge. Sending at once would undo the reason writes wait for a fresh
  status. Keeping it reuses the existing kept-message path, so it is restored
  with a reason if the read then fails, or if the person leaves. On a slow read
  the person briefly sees the message waiting as a kept bubble instead of a
  refusal.

## Review

This changes product behaviour, so it got a targeted `/llm-review`: one finder,
gpt-6-astra, with every candidate checked locally. Both candidates were real
and are fixed in a follow-up commit, with a store test that fails without the
fix:

1. A status read by `useConversation.refresh` *before* the invalidating event
   cleared the stale mark while the store's own re-read was still in flight.
   A kept message could then have gone on that older knowledge. A manual press
   could already do the same before this change. Now only the store's own
   re-read clears the mark.
2. A superseded failed re-read could mark a fresh status lost. Now only a
   still-stale status is marked lost.

The whole-file run at `OH_CPU_THROTTLE=4` then caught a hole in fix 1. After a
daemon restart, another reader applied a newer status while the store's
re-read was in flight. The re-read came back older than that status and was
dropped without settling the stale mark, so "status out of date" stayed and
the lost send was never re-sent. A store re-read is taken after the
invalidating event, so any status already held that is newer than it is fresh.
Now an older re-read settles the mark. The new store test fails without this
fix.

A follow-up review of the final store state (same thread) found one more
stranding path. A store re-read that outlived an epoch change, from snapshot
reconciliation or a stream from a new daemon life, returned without applying or
reading again. Under the in-flight rule nothing else cleared the mark. Such a
read now triggers a fresh read, and a store test covers it.

It also raised a gap that predates this change and is not widened by it: a
status another reader *sampled* before the invalidating event, but delivered
after the store's re-read failed, clears the mark. Closing it would need every
status reader to carry an invalidation generation. Writes stay under the
daemon's authority, so a client that is wrong here sends a command the daemon
judges against its real state. Recorded here, not filed.
