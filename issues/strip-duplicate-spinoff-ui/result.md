# Result: no second spinoff component above the strip pills

## Cause

The component was the thread's own "Spinoffit N" group (`SpinoffGroup` and
`useSpinoffGroups`). It is placed after the newest history row older than
the run, and a freshly started spinoff's creating row is the newest row. So
the group sat at the bottom of the thread, directly above the strip pills,
and repeated what the spinoff pill shows.

Reproduced in the lab: a seeded conversation with history, one running
process and one working spinoff created after the newest row
(`before-*.png`). The decided Merkit design (round
`2026-10-16-taustatyo-riff`, `implement-background-strip`) has no thread
group: spinoffs are the pill and its panel only.

## Change

- Removed `SpinoffGroup`, `useSpinoffGroups`, their CSS, the Storybook
  "Thread" story and the `nativeEntries` plumbing from `ConversationTimeline`,
  `BrowserConversation` and `HistoryView`.
- `SpinoffContext` stays and still feeds the strip. `keepKnownRuns` stays
  too: an incomplete read does not erase a run (`spinoff-group-disappears`).
- `design.md` (Keskustelu) states that the thread has no separate spinoff
  group.

## Evidence

- `spinoffs.spec.ts`: the read-only journey now opens the spinoff through the
  strip and asserts there is no "Spinoffit" region in the thread. The test
  from `spinoff-group-disappears` is rewritten for the strip: a run created
  before the loaded page stays across leaving, a partial read and settling,
  and loading the older page brings back no group.
- Lab before/after, desktop and phone, light and dark, captured by
  `web/lab/capture-strip-duplicate.mjs`: `before-*.png` and `after-*.png`
  (with HTML).
- Limits: synthetic lab. Jari's own screenshot was not fetched (maple
  unreachable when filed). The lab view is a read-only seeded conversation;
  the controlled view uses the same `ConversationTimeline` and is covered by
  `spinoffs.spec.ts`.

## Decisions for later review

- **The in-thread group is removed, not kept.** The issue said to keep it
  unless it was the duplicate. It is the duplicate, and the decided design
  has no thread group. As a result, a spinoff's place in the conversation
  (which message started it) is no longer shown. The tool call that ran
  `taskfleet run create` remains in the thread.
