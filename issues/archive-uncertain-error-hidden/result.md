# Result

## Cause

Confirmed. Archiving from a conversation's own view navigates to its
workspace and then sends the write. `performArchive` scoped the refusal to
`currentViewRoute`, a ref assigned during App render. React Router commits
navigations as transitions, so an urgent render in between (the notice update
itself) still renders the old location. When the 409 arrived first, the
refusal was scoped to the conversation route. It showed briefly while App
still rendered that route, then disappeared and was cleared by the
location effect once the workspace view committed. On the gate, the
stale-token refusal in `native-history.spec.ts` always reaches this branch,
and the load decides who wins.

## Fix

The view a refusal belongs to is read from the address bar
(`window.location`), which the router updates synchronously, the same way
the close action's refusal already decides it. On a Settings address it is
the view under Settings, as before, so a refusal that arrives while Settings
is open still shows when it closes (`rail-archive.spec.ts` covers this; a
first version without that mapping failed it). Scoping is unchanged
otherwise: the error shows where archiving left the person and is cleared
when they navigate elsewhere.

## Evidence

- New `web/tests/archive-uncertain-refusal.spec.ts` forces a 409
  `control_uncertain` by interception and throttles the CPU 20x through CDP
  so the reply lands while the workspace render is still pending. It fails on
  the old code (error visible, then gone within a second) and passes with
  the fix. It also checks that the error holds and does not follow into a new
  conversation.
- `--repeat-each 3`, `OH_BROWSER_WORKERS=2`: `native-history`,
  `rail-archive`, `archive-damaged-history` and the new spec 48/48; lab
  `lab-worktree-agent` and `lab-workspace-page` 27/27.
  `./scripts/test-web-fast.sh` green.
- `browser-conversation` (also an `archive-proof.ts` user) failed 8 of 264
  with the fix and 9 of 264 on main with the same command, in unrelated cases
  and none on archive. Filed as `browser-conversation-repeat-flakes`.

## Decisions for later review

- Address bar instead of render state for archive refusal scope.
  Alternatives: set the ref when navigating (overwritten by the next urgent
  render at the old location), or wait for the navigation to commit before
  sending (delays the write and changes optimistic behaviour). Chosen
  because it matches the existing close-refusal precedent and is what the
  person sees.
- `archive-proof.ts` left unchanged: its assertion was correct and it was
  catching the product defect.
