# alice-10-undo-one-page

Alice · 15:30 · Returns: 30 days. One page of the workers' change is undone
on Bob's word, and the undo is recorded in the page's history.

## What changed and why

- **Story.** The text says what history buys her: every change is recorded
  with what changed, when, by whom and why. One page goes back and the other
  sixteen stay, and the undo is recorded with Bob's reason, so it can be undone
  in turn.
- **The work is real git**, four short rows: `git log --full-history` on the
  page (the merge, the worker's commit, Bob's original), `git restore
  --source=81aa0f4` plus `git diff --stat`, a commit carrying Bob's reason,
  and a count that 16 pages still say 30 days. The old port's `git restore`
  printed a commit hash, which it never does; that is fixed.
- **The view is the page's history** (“History · wholesale.md”): a timeline
  drawn like the turn's rail, newest first. The undo is the highlighted top
  entry, tagged *Undo*, with its author, time, hash, reason and a 30 → 14
  chip; below it are the merge, the worker `online-orders`' commit and Bob's
  original terms. At the foot is the sentence as it reads now.
- **“Undo this too”** (own `client.js`) adds a new recorded entry at the top
  each time (14 ⇄ 30 days, new hash and time), moves the button to it, and
  updates the count and the “Now” line. The point it makes is that an undo
  is just another change, never an erasure. The added entry fades in, except
  under reduced motion.

## Assets

None (HTML/CSS only).

## Consistency with other blocks

- Bob's decision is dated 19 Nov, as in `alice-12`'s team notes.
- The merge at 13:55 matches `alice-day`'s returns sidebar (“Merging” 13:50,
  “Merged” 13:55).

## Engine needs

- `diff()`'s label is drawn uppercase, which mangles a hash or a time
  (“E93B4D0”), so this block gives it no label.
