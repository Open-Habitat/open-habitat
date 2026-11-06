# Result

Nosta and Ei nyt are one mark the person's own daemon keeps, behind the
experimental feature *Nosta ja Ei nyt* (`raise-to-your-turn`), implemented
from `design-system/prototypes/rounds/2026-11-06-nosta-kentan-luona/`
(direction C) and `2026-11-06-ei-nyt-paikka/` (direction A).

- Daemon: `POST /api/v1/conversations/<id>/turn` (`{"mark":"raised"}` or
  `{"mark":"not_now","reply_id":…}`) writes `~/.config/open-habitat/turn-marks.json`;
  the snapshot's agent carries `turn_mark`; the write publishes an
  agent-scoped `snapshot.invalidated`, so other tabs and devices re-read.
  The mark goes when Pi accepts the person's next message and when the
  conversation is archived. Contract: `contracts/v1/turn-mark.schema.json`.
- Browser: with the feature on, a reply opened but not answered stays in
  Sinun vuorosi with a ring ball; the composer row's middle slot (free while
  the agent is not working) is *Nosta* for a quiet conversation, *Ei nyt*
  for one waiting on a reply, and the orange *Sinun vuorossasi ✕* for a
  raised one. Hiljaiset rows have ⤒ and raised rows ⤓ beside rename and
  archive. Raised rows lead Sinun vuorosi, newest raise first, and so lead
  the next-waiting round.

Evidence: `internal/daemon/turn_marks_linux_test.go` (snapshot and reply
against the schemas, refusals, unreadable file, bound, clearing on an
accepted message), `web/tests/raise-to-your-turn.spec.ts` (two browser
contexts of one person against the real gateway and daemon: Ei nyt, Nosta,
lowering and raising from the other device's rail, reload, reply clears),
unit tests in `railNow.test.ts`, `Navigation.test.tsx`, `Composer.test.tsx`.

## Decisions for later review

1. **Where the mark lives.** A file of its own beside the account
   preferences, not `user-state.json` (archive's annotations) and not
   `preferences.json`. Alternatives: user-state.json would put it beside
   archive, but its writer lock is held by a running clone for its whole
   duration, so Nosta and the clear-on-reply would fail during clones;
   preferences.json is re-read by other devices only on window focus and
   is capped at 128-byte writes. Bounded to 512 marks and 128 KiB, oldest
   dropped first.
2. **Raised label.** The raised state reads *Sinun vuorossasi ✕* (raise
   round 3), as the brief says, not *Ei nyt* as the Ei nyt round's
   recommendation suggested for raised conversations. *Ei nyt* is the label
   only for a conversation waiting on a reply.
3. **Rail buttons.** ⤒ on Hiljaiset rows and ⤓ only on raised rows. A
   Sinun vuorosi row waiting on a reply gets no rail button (Ei nyt round
   2, direction A; its question 2 about ⤓ on every Sinun vuorosi row is
   still open). Alternative: ⤓ Ei nyt on every Sinun vuorosi row.
4. **A reply after the raise takes its place.** If the agent replies after
   the raise, the conversation shows as that reply (new or read), not as
   raised. This also ends a raise when the person answered from the
   terminal, which the daemon does not see. Alternative: keep the raise
   until the daemon sees a browser message.
5. **What ends a mark on the host.** Pi accepting any message from the
   person's browser (send, steer, follow-up, held messages), and archiving.
   A message Pi rejects keeps the mark. Restoring an archived conversation
   does not bring a mark back.
6. **Which replies wait read.** A reply waits in Sinun vuorosi only while
   the snapshot names it (`last_reply`: Pi running or resting unarchived)
   and only if it ended after the browser's first look (the existing
   per-browser horizon). A new device therefore shows older replies as
   quiet, and a reply whose Pi neither runs nor rests (after a daemon
   restart) leaves Sinun vuorosi. Alternative: a host-side horizon, such as
   when the person turned the feature on; it needs a second stored fact.
7. **No Ei nyt for a question.** A pending question keeps its row and the
   composer offers nothing: Ei nyt would not answer it.
8. **Nothing while the agent works.** Ohjaa and Stop own the middle slot,
   and a raised conversation at work shows in Käynnissä without a button;
   the raise returns it to Sinun vuorosi when the work ends.
9. **How other devices learn of a change.** The existing agent-scoped
   `snapshot.invalidated` event, not a new event kind: the other tab
   re-reads its snapshot (throttled) instead of applying a payload. A
   dedicated event would avoid the read but adds an event contract.
10. **A refused write** reverts the button and row in place; the refusal
    text is kept by the mutation layer but not shown separately.

Review: independent `/llm-review` (finder gpt-6-astra, verifier
claude-fable-5-1) and `/assess-findings`: three confirmed findings fixed in
this work (a raised conversation without native history lost its mark in
the snapshot; a stale read entry kept a row whose reply was gone; marks could
outgrow the file's read bound), three dropped (a snapshot/cursor race the
existing race invalidation already resolves, a millisecond race the UI cannot
reach, and a claim about terminal conversations that the verifier refuted).

Also fixed on the way, as they failed on main: the experimental-settings
spec's card list (it lacked `empty-conversation-start-page`) and one lab
script's formatting that failed `npm run check`.
