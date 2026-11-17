# Result

## Cause

The Muutokset card reads a turn's tool calls lazily, when an
IntersectionObserver says the turn is near the view (`useNear` in
`web/src/app/TurnChangesSource.tsx`). The observer used the page as its
root with an 800 px margin, but the conversation scrolls in its own area
(`.ah-conversation-stream`). The margin applies only to the root, and the
scroll area clips the turn's 1 px sentinel first, so the margin never took
effect. A turn was read only once the last pixel of the turn was inside the
scroll area. The newest turn is at the bottom when it ends, so it was always
read. An older turn whose bottom was never quite in sight, such as a long
turn read from the top, or one that a page load, jump or restored position
skipped past, never started its read and showed nothing. The browser trace
shows no block read at all for such a turn.

A second, smaller cause: a block read names the whole native file's
revision. Entries delivered by the stream carry the revision they were
saved at, and that revision is gone after the next append. A turn first read
later failed silently until a history page replaced its entries.

## Fix

- The observer's root is the nearest scrolling ancestor, so turns within
  800 px of the visible conversation are read before they come into sight.
- A block read tries the entry's own revision first, then the conversation's
  newest one.
- When a turn that edited or wrote files cannot be read, a short line says
  so: "Vuoron muutoksia ei voitu lukea. Yritä uudelleen". It is retried on
  the next revision or on request. An earlier card stays when a re-read
  fails.

## Evidence

- `web/tests/turn-changes.spec.ts`:
  - *every editing turn shows its card, older pages and a warm return too*:
    140 synthetic turns (`/fixture/history?mode=turn-changes-many`), older
    pages read on scroll-up, every even turn shows its card with its counts
    and every odd turn shows none, then a warm in-app return.
  - *every live turn that changed files keeps its card*: live turns through
    the fake Pi (`kirjoita tiedosto <name>`), a cold reopen, two more live
    turns, then every earlier turn. This test failed before the fix and
    passes after it.
- Spec run 3× green: 24 passed, 3 skipped (the opt-in evidence capture),
  with `OH_BROWSER_WORKERS=2`.
- `web/src/app/TurnChangesSource.test.tsx`: the observer root, the revision
  fallback, the unread line with retry, and silence for a command-only turn.
  Three of the four fail on the previous code.
- `./scripts/test-web-fast.sh` passed.

## Decisions for later review

- **A turn whose changes cannot be read says so briefly.** This replaces
  turn-changes-summary's "a turn whose reads fail shows no card". That rule
  was about not showing a partial or wrong card, and a one-line notice keeps
  it. Alternatives: stay silent (the reported confusion), or show a partial
  card (could be wrong).
- **The notice appears only for turns with an edit or write call.** A turn of
  reads and commands most likely changed nothing, and almost every turn runs
  a command, so a notice there would be noise. A failed read in a turn whose
  only change was a `bash rm` stays silent.
- **A "Yritä uudelleen" (try again) button** is included. A settled
  conversation gets no new revision, so without it a failed read would never
  be retried.
