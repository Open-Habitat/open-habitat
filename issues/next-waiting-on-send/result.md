# Result

Implemented **Vuoron loppuun** inside the existing, default-off
`next-waiting-row` experiment. No daemon, contract, native session state,
write semantics or authority changes.

## Decisions for later review

- A successful existing send/steer/follow-up HTTP acknowledgement opens the
  window, including a message held by the host while Pi starts. Waiting for
  native delivery instead would contradict the chosen host-acceptance trigger.
  Restored held messages and receipt recovery never open a new window.
- A lost acknowledgement closes the window, just like a refusal; we do not
  reconstruct it from later receipts. The alternative would suggest that a
  send succeeded before its outcome is known.
- Unknown/stale status temporarily hides the row without treating it as turn
  completion. A confirmed question, interrupted/failed start, rejection,
  archive, observed running-to-idle transition or new settled-turn key closes
  it. A background worker alone does not extend the agent's turn.
- The two recommended answers in the brief are implemented: an empty window
  can show new waiting conversations during the same turn; opening the next
  conversation carries no window there. Queued messages count as sends, not
  as promises of a window in a future turn.

## Removed

Removed `WaitingRound`, its App subscription and synchronization, frozen
steps, visited/handled/elsewhere counts, pruning/joining, position/backtracking,
completion/elsewhere notices and their timer, round keyboard handlers,
`NextWaitingQueue`, its stories/tests, queue CSS and both round catalogs.
The row no longer has a note slot. Both language catalogs and the experimental
feature card now describe **Open next**, not a round.

The removed unit/component tests distinguished round order, pruning, handled
states, completion and previous/next controls. Those behaviors no longer exist;
they are not retained as requirements. The replaced browser journeys used to
assert that reading counted as handled and that a round followed outside its
steps. New journeys instead require no carried bar, rail order and a fresh send
at the destination. The Alt-down action, default-off gate, small viewport fit
and row accessibility remain covered. Alt-up/Escape no longer belong to this
feature.

## Evidence

On Birch, private disk-backed TMPDIR, umask 077, OH_PORT_BASE=9350 and
OH_BROWSER_WORKERS=2:

- `npm ci --prefix web` and
  `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` completed.
- `./scripts/test-focused.sh --area web`: static checks, TypeScript and
  **161 files / 1182 unit and component tests passed** after rebasing.
- `./scripts/test-focused.sh --area browser --spec next-waiting-row.spec.ts`:
  **4 browser journeys passed**, post-rebase run 2.0 minutes. Covers withheld send
  acknowledgement, default off, live count changes and archive removal, empty
  window and reappearance, finish, question, refused queued send, archive here,
  rail departure, reload, external send, click/Alt-down to the first waiting
  conversation, new send at destination, phone width and axe for the row.
- Unit regressions cover a fast turn settling before working was rendered,
  late acknowledgement after completion, old-visit callbacks including an
  A→B→A visit, stale status recovery, failure and confirmed turn end.

Browser evidence uses the real gateway/controller with synthetic users and Pi.
Question and overlapping-turn status observations are intercepted, validated
responses; the live empty/reappear case explicitly refreshes after releasing
its held status observation. This is not live-provider or Linux UID-isolation
evidence. No full gate or whole browser suite was run.

Focused self-review traced all three send paths, visit lifetime, failed and
late acknowledgements, turn-end facts and the live rail order. It found and
fixed a late-acknowledgement reopen race and ensured held-message cancellation
closes the window. There is no native session-state change requiring an
independent architecture/security review.

Development check failures were corrected: one formatter/removed-variable
failure; a browser test that tried to send again after an intentionally
uncertain 503 (changed to a definite refusal for that journey); a creation
helper that read the temporary `conversation=new` URL (now waits for Pi ID);
and an intercepted status that needed an explicit refresh before asserting
its released state. Final focused runs passed. Initial file lookups/deletion
included nonexistent paths; only verified existing obsolete files were removed.
A precise edit first failed its exact-text match and was reapplied against the
actual text. After rebasing, an untouched `SpinoffConversation` unit test hit
its five-second timeout; the entire focused web check passed on retry.

Rebased onto main c4b97d6d, including the interrupted-turn rail fix and normal
single-workspace rail. One ordinary App conflict combined removal of the round
with the other worker's new single-workspace comment; both behaviors were
preserved. The post-rebase web and four browser journeys above passed on
36ecf579's runnable tree. `issuectl doctor --json` reported no schema
violations or warnings; project-view validation and `git diff --check` passed.

`KOKEILTAVAA.md` replaces the obsolete round checks with this direction's live
acceptance journey. Remaining acceptance: Jari's live use on the next deployed
version, including real provider timing and Safari.
