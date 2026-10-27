# Result

## What moved the focus

`App.tsx` moves focus to the page heading when the view changes: on
navigation, and when the session phase changes (signed in, loading, Pi
required). It compared the raw Redux phase, and a failed background
snapshot refresh changes that phase from `authenticated` to `stale` and back
on the next good read. The view stays the same, only the connection banner
appears, but each flip counted as a new view. Focus went to the workspace
heading (`h1[data-testid=workspace-title]`), and keystrokes after that went
nowhere.

A live turn refreshes the snapshot whenever its status changes: when the
interim reply is saved, when a tool ends, and at the final reply. In the lab
that is about every 4–6 s. So whenever one of those refreshes fails, focus
leaves the composer right after an interim reply. That matches the report.

Fix: the focus effect treats `stale` as the same view as `authenticated`
(`web/src/app/App.tsx`).

## Evidence and its limits

- `web/tests/lab-composer-live-focus.spec.ts` (desktop 1280×800, phone
  390×844) types one character at a time through a whole `hidas` turn in the
  lab (fake Pi: interim reply, bash tool row, final reply) and keeps typing
  after it settles. It also fails the snapshot read that comes after the
  interim reply with a 503. It checks that the field never fires `focusout`,
  is still focused, holds exactly the typed text, and has its caret at the
  end. Without the fix both viewports fail with focus on
  `h1[workspace-title]`. With the fix both pass.
- Without a failed refresh, the lab never moved focus, in either viewport,
  in a new conversation or across three consecutive turns (`pi-deltas` and
  `pi-typed`, including `näytä kortit` / `muokkaa tiedostoa`). I logged every
  programmatic `focus()` call and every `focusout` from the field to check
  this. Message mounts, tool rows, scroll-to-latest, the jump chip and
  aria-live regions did not move focus.
- **Not shown live.** Birch's daemon journal since 2026-10-26 has no failed
  `/api/v1/snapshot` reads for `maintainer`: 704 completed and 79
  `client_canceled` (superseded reads, which the browser ignores). A browser
  that fails a read for its own reasons leaves nothing in that log: a dropped
  connection or a read that fails its timeout or validation. That kind of
  failure is the likely live trigger, but this fix is not confirmed until
  Jari tries it on the test machine.

## Decisions for later review

- Only the stale flip was changed. Two other phase changes still move focus
  to the heading. One is a changed sign-in, where another tab signed in and
  the view is rebuilt as `loading`. The other is single-workspace mode
  replacing `/` with `/workspaces` when the number of visible workspaces
  changes. Both rebuild the view rather than refresh it, and neither showed
  up in the lab. If Jari still sees focus jump, those two are the next
  candidates.
