# Result

Run `01m5yq43jzcd98etv37ek94fr7`, on Birch (still `0.1.0-pilot.12`).

## Cause

Two defects of pilot.12 that are already fixed on `main` and on the test
machine (`0.0.0-pilot.446`, e25a4c62). Nothing in this run changed product
code; it adds the browser test that walks the pause.

- **The page stays stale after a wake.** On waking, the first reads fail
  while the network is still coming up. In pilot.12 a failed snapshot read
  made the phase `stale` (*Yhteys katkesi*) even when the event stream was
  open, and nothing read again: in an idle conversation, Pi stopped for
  idleness, no event comes to trigger another read. Send stays refused (the
  button is `aria-disabled`, Enter does nothing) for as long as the page
  lives. Switching conversations does not read the snapshot, a reload does.
  That is exactly the report. Fixed by 09c6d518 (`stale-banner-while-live-works`):
  a failed read while the stream is live keeps the phase and reads again
  after a short backoff, and a stream that opens reads at once.
- **The focus leaves the field.** When the stream was cut during the sleep,
  the recovery flips the phase `stale` -> `authenticated`, and pilot.12 treated
  each flip as a new view and moved the focus to the workspace heading while
  the person was typing. Fixed by 60da8da8 (`composer-focus-stolen-by-interim`).

## Evidence

- Birch logs (gateway and daemon `http_request` and `conversation_idle_stop`
  metadata only, 2026-10-27): no host failure; snapshot reads all 200 or
  `client_canceled`; Pi was stopped for idleness eight times during the day
  (after 10 minutes), so after an hour's pause the conversation is idle and
  silent. Browser-local read failures leave no host trace, as the
  `stale-banner-while-live-works` investigation already showed.
- New `web/tests/long-pause-composer.spec.ts`, two cases: an unsent draft,
  offline sleep, an hour on the page clock, `/fixture/idle-stop`, and three
  seconds after the wake in which snapshot and event reads fail. Then the
  person clicks the field, types, and sends with Enter; the case expects
  every key in the field, the focus still there, no stale notice and the
  message delivered. "stream survives" keeps the open stream through the
  sleep; "stream drops" cuts it with `daemon-restart?transport_only=1`.
- Run against a disposable pilot.12 checkout (with `/fixture/idle-stop`
  backported into its synthetic host only): both cases fail. "survives"
  stays stale; a diagnostic variant showed it still stale after ten more
  minutes on the clock and after switching away and back, Send disabled, and
  recovered by a reload. "drops" fails `toBeFocused`.
- On `main` both pass (five runs). Counterfactuals on `main`: reverting
  09c6d518 and 40f1f370 fails "survives" with the stale notice; reverting
  60da8da8's `App.tsx` change fails "drops" on focus. Each case thus pins one
  fix.
- Simulations that did not reproduce on pilot.12 either: idle stop alone,
  hidden tab (`visibilitychange`), offline without failed wake reads,
  gateway restart, daemon restart, and the recap scenario with a draft.

## Decisions for later review

- No product change. The brief's fallback ("main no longer reproduces")
  applies; the remaining value is the regression test.
- The test machine was not exercised by hand: a real laptop sleep cannot be
  driven from here. It carries both fixes, so the KOKEILTAVAA line asks Jari
  to try it there.
- The trigger on Jari's machine (which read failed on wake) is inferred, not
  observed; the host cannot see it. The `[reconnect] snapshot-failed`
  diagnostic of 09c6d518 would name it on a recurrence.

## Checks

After rebasing onto main (dbd98e58): the whole browser suite 416 passed,
3 skipped; the lab suite 136 passed, 1 failed:
`lab-skill-invocation` "recorded skill reader 1440 dark" (Escape left the
skill panel open under load), which this change does not touch and which
passed 6/6 on its own afterwards.
