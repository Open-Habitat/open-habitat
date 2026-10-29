# Result

The Työssä direction of research-workmux-sidebar round 3b, behind the
`next-waiting-row` switch in Kokeelliset ominaisuudet (off by default; the card
no longer says *Tulossa*).

- **When.** Once the host confirms that this conversation's agent works (run
  active, the same fact the top bar's *Työskentelee* reads), a slim line is
  docked between the background strip and the composer:
  *Sillä aikaa ● title · kysyy / uusi vastaus · age +N · Avaa Alt+↓*. It stays
  for the rest of the visit, also after the agent finishes. Nothing shows while
  this conversation asks a question, while its status is unknown or stale, or
  when nothing else waits.
- **What.** The next one of the rail's Sinun vuorosi, skipping conversations
  opened in this walk; when all have been opened the walk starts again. Another
  workspace's name is said. On the phone (≤ 800 px) the line keeps the ball, the
  title, the count and Avaa.
- **Keys.** Alt+↓ opens the offer while the line shows; Alt+↑ steps back to the
  conversation before this one in the walk, and otherwise leaves the key to the
  field.
- **Handled elsewhere.** When the offered conversation leaves Sinun vuorosi
  (a question answered on another device), the offer moves on and the line says
  once *X hoidettiin toisaalla.* for five seconds.
- **Off.** Nothing renders, no key is taken, nothing is fetched; the feature
  reads only what the rail already has.

Code: `web/src/app/nextWaiting.ts` (the walk), `web/src/app/NextWaitingDock.tsx`
(switch, confirmation latch, keys), `web/src/components/NextWaitingRow.tsx`
(the line). Tests: `nextWaiting.test.ts`, `NextWaitingRow.test.tsx`,
`web/tests/next-waiting-row.spec.ts` (off shows nothing, on appears on the
working confirmation and not before, stays after the turn, Alt+↓/Alt+↑, phone,
axe). Evidence: `evidence/tyossa-desktop-light.png`, `evidence/tyossa-phone-light.png`.

## Decisions for later review

- **Order follows the rail (catalog order), not most recent change first.**
  Alternative: sort by `changed_at`, which now exists. The card already says
  *Järjestys seuraa toistaiseksi sivupalkkia*, and an offer in the order the
  person sees in the rail is easier to predict.
- **The line latches per visit.** It appears on the first confirmed run seen
  while the switch is on and stays until the person leaves the conversation.
  Opening a conversation whose agent already works shows it too; returning to a
  finished one does not, until the next reply. Alternatives: show it in every
  conversation that does not need the person (the prototype's literal rule), or
  only after a send from this tab. The issue asks for the host's working
  confirmation, and that is the one fact the browser has for "you can leave
  now".
- **Switching the feature on mid-visit shows nothing until the next confirmed
  run.** Work seen while it was off does not count, so turning it on never
  makes something appear out of nowhere.
- **The walk is tab memory, kept by the app for the signed-in person** and
  dropped on reload or another sign-in, like the rail's unread marks.
- **Only browser conversations show the line.** A terminal agent's view
  (`/agents/…`) has no composer of its own here; it still counts as a visit.
- **"Handled elsewhere" moves only on questions.** A reply read on another
  device stays unread here, because "seen" is tab-local (the cross-device seen
  record is a separate decision in the research).
- **The Alt+↓ hint's contrast:** the prototype's 80 % opacity failed axe on the
  accent background, so the hint is full strength.

## Review

Focused self-review: the change is web-only, reads the rail's existing model
and the existing preferences hook, and touches no daemon, contract, session
state or authority path.
