# Result: race group 2 (input before the conversation view is ready)

Done 2.11. on Birch, rebased on main `86026bb2`. Detector: the synthetic
host's reply delay 0–250 ms (`OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=r54-input`),
`--repeat-each 2`, `OH_PORT_BASE=11100`, 2 workers.

## What was wrong

Traced case by case (probes in the specs and the page, removed afterwards).
Three mechanisms, one of them in the daemon:

1. **The field was replaced twice while the person used it.** A new
   conversation was drawn by App's `CreatingConversation`, then by
   BrowserConversation's loading view (`PendingConversation`), then by the
   opened view: three textareas, three frames, three headers. Whatever the
   person was doing at the swap was lost: focus left the field
   (lab-composer-live-focus), an open `/` list or the attachment control went
   with its composer (lab-composer-area `:206`, `:349`), a captured region
   detached (bang-spacing), a frame marked before Settings was not the one
   after it (settings-close). Keys typed between App adopting the creation
   draft and the redirect went to the creation key that had just been
   emptied, so the opened view had an empty field and Send stayed disabled:
   that is the r54 gate's phone-composer-keyboard `:56` failure ("Send
   disabled after the view opened"), the same group.
2. **Enter in the loading view did nothing.** Its composer was blocked and
   the composer returns silently on a blocked send (long-pause `:32`,
   queued-send `:491`: the first message was dropped, the text stayed, no
   word why). Typing there never woke a resting Pi either, because only the
   opened view's field called the wake (queued-send `:170`).
3. **A wake that reached the daemon after the send it raced was lost.** With
   the wake fixed in the browser, `:170` still failed half the time: the
   typing wake and the send are two requests, and when the send arrived
   first it started Pi `lazy` (only to deliver held messages); the wake then
   answered "already starting" without making that Pi the person's, so
   taking the message back stopped Pi again.

## What changed

- Creation, loading and the opened conversation are one view.
  `BrowserConversation` takes a `creation` (what `CreatingConversation`
  took) and renders all three states in one `ConversationFrame` with one
  `AgentHeader` and one `Composer` at fixed positions; the frame carries
  `data-view`. App renders the creation route through it with a `viewKey`
  the created conversation keeps (`creationViewKeys`/`createdViews`), and
  gives it the created ID in the same render that starts the redirect. The
  creation draft and waiting messages live under the creation keys inside
  `useConversation`/`useHeldMessages`; at the creation→ID render the view
  adopts whatever is still under them.
- A message sent before the view can act on it (still opening, an earlier
  send or Stop on its way, its outcome pending) leaves the field as a sent
  one does, waits as a bubble, and goes once the view can, in order, the way
  the send button would send it then (`tell`). If the opened conversation
  refuses it, the text goes back into the field with a notice saying why. A
  view that is left or reloaded gives its kept messages back to the field,
  never sends them later (stored in session storage as they are kept).
- A blocked send is never silent: the composer words the refusal
  (`composer-notice`), and a press on a disabled Send does too.
- The paperclip stays enabled while a message could be kept, so a person
  using it is not dropped by the swap.
- Text typed before the view knows Pi rests wakes it once it knows.
- The opening focus treats the heading the app focuses on navigation as no
  target, so a keyboard-opened conversation still lands in the field.
- Daemon: a wake that joins a Pi started for held messages clears `lazy`;
  both orders now keep the woken Pi up
  (`TestAWakeDuringAHeldStartKeepsPiUp`, fails without the fix).
- settings-close marks the frame before creation and then waits for the
  opened conversation (`tests/conversation-view.ts`, `openedConversation`):
  the address it compares is the created conversation's.

Pinned in Vitest with the stepped transport
(`src/app/conversationView.test.tsx`): one field from creation to opened,
kept messages sent in order once the status read is delivered, given back
with a notice when the opened conversation cannot take them, given back
after a reload, and the wake for text typed before the rest was known. Each
fails with its mechanism disabled (checked). `Composer.test.tsx` adds the
worded refusal and the pass-through.

## Counts (failures / runs, D250, `--repeat-each 2`)

| Case | Before | After |
| --- | --- | --- |
| long-pause-composer `:32` (×2) | 3/4 | 0/4 |
| queued-send `:170` | 2/2 | 0/2 (0/8 in two more runs) |
| queued-send `:491` | 1/2 | 1/2, then 0/6 (see below) |
| settings-close `:81`, `:122`, `:160` | 6/6 | 0/6 |
| new-conversation-placeholder `:39` | 2/2 | 2/2 (group 8, see below) |
| server-version-reload `:140` | 0/2 | 0/2 |
| phone-composer-keyboard `:56` (×2) | 0/4 | 0/4 |
| lab-composer-area `:122` | 0/2 | 0/2 |
| lab-composer-area `:206` | 2/2 | 0/2 |
| lab-composer-area `:349` (×4) | 8/8 | 0/8 |
| lab-composer-live-focus `:28` (×2) | 4/4 | 0/4 |
| lab-composer-bang-spacing `:9` (×4) | 4/8 | 0/8 |
| Total | 32/46 | 3/46 |

Line numbers are the sweep's; settings-close moved by two lines.

Unloaded, the previous worker ran both whole suites on the change (it
reaches every conversation journey) before it stopped. Its final numbers were
not recorded.

## Not group 2

- **new-conversation-placeholder `:39`**: what fails now is axe colour
  contrast in the rail during the 220 ms fade (`#408563` on `#f1f3f5`),
  group 8, for `race-spec-signals` (reduced motion in the configs). Its
  layout checks pass: header and composer are the same elements now.
- **queued-send `:491`** once: the message handover sample saw the held
  bubble and the native message together for 100 ms (bound 50 ms). The
  input part (both messages kept and held in order) passes every run; the
  overlap is the held-message handover, 0/6 on a rerun.

## Review

Independent `/llm-review` (finder gpt-6-astra) and `/assess-findings`: two
confirmed findings, both fixed here. Kept messages lived only in React state,
so a reload lost them (now stored as they are kept and given back on the
next view); giving them back could overwrite a restore made in the same
render (now reads the current draft). No verifier call: both were confirmed
in the code and the fixes are local.

## Decisions for later review

- **A message sent before the view is ready is kept as a waiting bubble,
  not kept in the field.** Alternatives: keep the Enter as a pending press
  with the text in the field (tried first: a person who presses Enter and
  writes the next message turned both into one, queued-send `:491`), or post
  it at once as a held message (the daemon would decide, but it would be
  drawn as "waiting for the agent" even when Pi is idle). The bubble is the
  agreed waiting look, and the text then goes the way Send would send it.
- **A lost status read still refuses sending.** A kept send during a failed
  read's retry was tried and reverted: lab-composer-area `:59` states that a
  send refused during a lost completion status is not sent after recovery.
  The refusal is worded now instead of silent.
- **Kept messages from a view that is gone come back into the field**
  rather than being sent when the conversation is next opened, so nothing
  goes later unasked.
- **The two uncertain looks stay** (the race-status-merge hand-off): a
  message sent before Pi runs is held by the daemon and its unknown outcome
  is drawn on its bubble; a direct send's unknown outcome gives the text back.
  They are two daemon outcomes, not two views of one. What made the same
  send take either path by timing was the creation/loading split, which is
  gone: a kept message takes the path the view would take when it goes.
- **A woken start whose new child dies during startup shows its failure when
  the held message is taken back** (harvest review fix). Before, taking the
  message back turned any dead `starting` handle into a quiet `stopped`. Now
  only a start that is still lazy (nobody woke it) is cancelled that way,
  because before the child is replaced the old handle is also `dead`, and the
  person's wake must survive. Alternative: tell the two dead states apart with a
  new flag. Not done, because a failed wake the person asked for is honestly a
  failure.
- **The creation dictation hold stays.** With one composer a swap no longer
  ends a dictation, so App's wait for it is no longer needed; it is left as
  it was to keep this change to the input path.

## Harvest onto main (3.11.)

The run died before merge. Harvest run `01m6fx4hmwph2jfsxa47yttekp` replayed
it onto main `9014a93a` as two commits, daemon and web. The only conflict was
main's recap presentation hold (`useRecapPresentationHold`) in
BrowserConversation. The branch's file was kept, and the hold's reveal call
was put in the recap action's handler; the shared composer already notes
recap activity (`onActivity: recapHold.note`). The review fixes listed above
are in the code: kept messages are stored as they are kept and given back
after a reload, and the give-back reads the current draft (`restoreKept`).

What the harvest changed:

- **queued-send `:305`** ("a reload while a message waits") failed 4/4 under
  the detector against 0/4 on main. Its readiness signal, an enabled field,
  now also holds while the view opens. A message sent then is kept by the
  tab, and the reload gives it back to the field, which is the decision above.
  The spec now waits for the opened conversation (`openedConversation`)
  before sending, as the case is about the daemon's held message. 0/4 after.
- **Daemon review fix** (below): cancelHeld no longer cancels a woken start
  whose handle still has the dead child.

Detector counts on the harvested tree (`OH_REPLY_DELAY_MS=250
OH_REPLY_SEED=r54-input`, `--repeat-each 2`, `OH_PORT_BASE=11100`, 2 workers):

| Run | Result |
| --- | --- |
| long-pause-composer, queued-send, settings-close, new-conversation-placeholder, server-version-reload, phone-composer-keyboard | 68/68 passed |
| lab-composer-area, lab-composer-live-focus, lab-composer-bang-spacing | 32/32 passed |
| lab-conversation `--grep recap` (main's recap fix meets this change) | 9/10; `:55` also fails on main (1/6), filed as `intensely-talented-ornament` |
| long-pause `:32` stream drops, queued-send `:170`, server-version-reload `:140`, ×4 | 0/12 failed (main: 8/12) |

An earlier pass over the same specs, before main's recap change, had 4/68.
Three of those were load misses that passed on rerun (0/12 above); the
fourth was `:305`. `lab-composer-area :349` (attachment picker) times out
waiting for a file chooser that the page asked for: 5/80 on main, about
3/160 here. Filed as `singularly-rough-flag`, not this change.

Also passing: `./scripts/test-focused.sh --area web` (1263 tests) and
`--area go --go-package ./internal/daemon`, plus a `-race` run of the held and
wake tests.

### Harvest review

The diff differed from the one reviewed before (post-review fixes, the
rebase, the spec change), so a fresh `/llm-review` ran: finder gpt-6-astra,
verifier claude-fable-5-1, then `/assess-findings`.

- **Confirmed, fixed:** a wake that joins a held start before its child has
  been replaced (the handle still `dead`) cleared `lazy`, but taking the
  message back still hit cancelHeld's `starting && dead` case, so Pi never
  came up although the wake answered "starting". This is reachable through
  `relaunchFresh`, for a conversation created in this daemon that has no
  native file; `resume` replaces the handle regardless. The case now
  requires `lazy`. `TestAWakeBeforeTheHeldChildExistsKeepsTheStart` fails
  without it. The reap test's held start now carries `lazy: true`, as
  `holdLocked` sets it.
- **Dropped (unable to verify):** a `/command` send whose skill lookup
  resolves after the creation→ID hand-off could call the creation callback
  and strand the message under the creation key. Composer aborts the lookup
  when availability and send state change, and both change at the hand-off.
  What remains is the gap between the commit and the effect cleanup, which
  depends on React's scheduler.
