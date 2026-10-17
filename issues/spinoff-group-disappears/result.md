# Result: the spinoff group no longer depends on the loaded history page

## Cause

The thread places a spinoff group after the newest loaded row that is older
than the run's `created_at`. The browser holds only the newest history page
(25 entries) when a conversation is opened again; on the first visit it had
grown the window live from the start. The test server confirms the live case
read-only (timestamps and counts only, no content, 2026-10-17): the parent
session behind `ui-test-ok`/`ui-test-fail` had 69 message entries, 37 of them
written after the two runs were created at 16:04:37–38 UTC. On returning, the
creating row was outside the loaded page, so no row qualified and the group
was silently dropped; the waiting line above the composer comes from the
process inventory, not from the thread, so it stayed. Taskfleet itself
answered in 0.02 s there, so read timeouts were not the cause.

## Change

- `useSpinoffGroups` (`web/src/components/Spinoffs.tsx`): a run created before
  the loaded page is shown at the top of the page, where older history
  continues; loading the older page moves it to its native row. Groups are
  now thread rows of their own (`data-kind="spinoffs"`), so a group placed by
  a person's message no longer sits beside the message bubble.
- `keepKnownRuns` (`web/src/app/SpinoffConversation.tsx`): a `partial` or
  `unavailable` read keeps the runs it did not mention, with the existing
  "Tila voi olla vanhentunut." notice, instead of erasing them. Taskfleet
  retains settled runs, so absence from an incomplete read is not removal.
- The waiting line's spinoff names are underlined and turn accent-coloured on
  hover, so they read as links. `implement-background-strip` replaces this
  line in the same run.

## Evidence

- `web/tests/spinoffs.spec.ts` "group stays when its creating row is older
  than the loaded page…": newest page only, leave the conversation and come
  back, a partial read that omits the run, settling to merged, then loading
  the older page. It fails on the previous `useSpinoffGroups` (group not
  found) and passes now; host-backed synthetic evidence.
- Lab screenshots with HTML snapshots, desktop and phone, light and dark:
  `group-top-*.png` / `.html` (captured by the same test with
  `OH_SPINOFF_CAPTURE=1`).
- `scripts/test-focused.sh --area web` and `--area browser --spec
  spinoffs.spec.ts` pass.

## Decisions for later review

- **Runs older than the loaded page go to its top**, not to a separate
  "earlier spinoffs" place. An old merged spinoff of a long conversation
  therefore shows at the top of the newest page until older history is
  loaded; it is above the reading position, which starts at the bottom.
- **No cache of spinoff reads across conversation switches.** The group
  appears after the first read on return (one fast request), as before.
