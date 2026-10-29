# Result

The recap card hid whenever the conversation's status was anything but
`idle`/`rejected`. A resting conversation's status is `stopped` (no Pi in this
daemon), so its native recap, which the browser had already read from history,
was treated as "a turn is running" and hidden until typing woke Pi. The recap
read itself was already native and independent of a live Pi.

The card is now hidden only while a turn may run (`pending`, `accepted`,
`uncertain` or `run_active`; `turnUnderway` in `web/src/app/conversations.ts`).
While Pi rests, the card's refresh is disabled with *Agentti lepää.
Kirjoittaminen herättää sen.* instead of the misleading *Odota agentin vuoron
päättymistä.*

Evidence: `web/tests/recap-resting.spec.ts` (first case) writes an automatic
recap, restarts the daemon and reloads: the card shows while status stays
`stopped` and nothing wakes Pi. The case fails on the previous
`BrowserConversation.tsx`. Unit cases in `conversations.test.tsx`.

## Decisions for later review

- `starting`, `stopping` and `start_failed` also keep the recap visible; only
  states in which a turn may run hide it. Alternative: hide during `starting`
  too. Chosen because a start with no message yet does not change what the
  recap describes, and a sent message dismisses the card anyway.
- The refresh button's disabled reason while resting is new text: *Agentti
  lepää. Kirjoittaminen herättää sen.* Alternative: keep the old reason, which
  was wrong for a rest.
