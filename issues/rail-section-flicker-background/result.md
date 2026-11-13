# Result: rail-section-flicker-background

## Cause

The flicker was in the browser's read model, not in the daemon's activity
classification. The rail took a conversation's turn facts (`run_active`,
`state`, `pending_question`) from the conversation's cached status only while
that status was fresh. Each agent-scoped `snapshot.invalidated` event marks
the status stale until it is read again, and while it was stale the rail fell
back to the snapshot's facts. Since `e1b5bb0e` (a fix to keep Ei nyt on a
settled row) that fallback applied whatever the snapshot's age.

A running turn writes its session file several times a second, and every
burst is an invalidation. On the live route a snapshot read takes seconds,
so for a conversation the person is not looking at, the snapshot still
showed the state from before the turn while the status already showed the
turn. Each invalidation moved the row to the snapshot's section, and each
status read moved it back:

- turn begins on a read reply: status `run_active: true` puts the row in
  Käynnissä, the older snapshot (`run_active: false`) puts it in Sinun
  vuorosi;
- turn ends: the same alternation the other way round until a snapshot
  taken after the end arrives.

The background-process marker on the row came from the older snapshot
(`waiting_on` is reported only between turns), which is why the reported row
showed both the marker and Käynnissä. The background processes themselves
did not cause the alternation; any non-open conversation whose turn begins
or ends can show it.

## Fix

`heldStatus` in `web/src/app/conversationStore.ts` returns the status when it
is the newest observation the tab holds. A stale status still counts while
it was read at or after the snapshot's journal position in the same daemon
life (`journal_cursor` against the snapshot's `event_cursor`, which the
store now keeps in its metadata). A snapshot read after the status still
replaces it, so the case `e1b5bb0e` fixed (a cached turn hiding Ei nyt on a
settled row) keeps working; its test still passes unchanged.

The rail (`railNow`), the home page's conversation cards (`HomeWorkspaces`)
and the return view (`ReturnView`) all had the same stale fallback and all
use `heldStatus` now.

Regression test: `railNow.test.ts` "keeps a turn's section while
invalidations outrun the snapshot" drives the real store through turn start
and turn end with interleaved invalidations and status reads. On the old
code it alternates `running`/`yours`; with the fix it stays put.

Validation: focused web checks (lint, typecheck, 1606 unit/component tests)
and the browser spec `rail-archive.spec.ts` pass.

## Decisions for later review

- Which section an ended turn with running background processes belongs to
  is already decided by the existing design (the `waitedFor` rule in
  `web/src/components/agentPresentation.ts`): a process started within the
  latest turn, or a Taskfleet wait, keeps the conversation in Käynnissä
  ("Odottaa taustatyötä"); a process started before the person began the
  latest turn is a background service, and the row goes by its reply (Sinun
  vuorosi or Hiljaiset) with the quiet service mark. This fix does not
  change that.
- A status read from a different daemon life than the snapshot is never
  treated as newer: two lives have no order, so the snapshot applies until
  the status is read again.

## Residual (not filed)

The daemon reports `waiting_on` only when a conversation's process bridge
answers the snapshot's inventory query within 600 ms, and marks
`before_turn` only when the branch scan succeeds. A conversation with a
process started in its latest turn could therefore move between Käynnissä
and Sinun vuorosi if those reads failed intermittently. The daemon's
request timings around the reported flicker show the inventory answering in
at most about 130 ms, so this did not cause the report; it is noted, not
filed, because no occurrence has been seen.

## Live check

Open conversation A, send it a message that makes the agent work for a
while (for example "run `sleep 20` and then answer"), and switch to
conversation B at once. While A works, its row stays in Käynnissä without
jumping to Sinun vuorosi; when A answers, the row moves to Sinun vuorosi
once and stays there.
