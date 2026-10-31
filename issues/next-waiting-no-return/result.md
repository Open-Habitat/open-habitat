# Result: hidden while this conversation awaits you; a round without the way back

Implemented 31.10.2026 inside the experimental `next-waiting-row` (Jono).

## Why Jari saw the row

The start line (*Sillä aikaa · N odottaa sinua · Käy läpi*) latched on the
first time the host confirmed this conversation's agent working and then
stayed "for the rest of this visit, also after the agent finishes"
(`NextWaitingDock`'s `engaged` state). It hid only for a pending question
or an unknown status, so a turn that had simply ended, with Jari's turn to
write, kept it on screen. The line did not list the conversation itself:
it already filtered this conversation's id out of Sinun vuorosi, and the
title in the screenshot was another conversation.

## What changed

- `web/src/app/NextWaitingDock.tsx`: the start line shows only while the
  host confirms this conversation's agent works; the latch and the
  `needsYou` input are gone. It goes when the turn ends or the agent asks,
  and comes back when it works again. The filter that keeps the
  conversation itself out of the line stays, with a comment.
- `web/src/app/nextWaiting.ts`: `WaitingRound` has no origin step. A round
  is the other waiting conversations in the rail's order, walked forward;
  ↑ steps back within it, never before its first step. Past the last step
  the round ends where the person is with *Kierros käyty: N hoidettu* and
  leads nowhere. The start joins the round's end like any other once its
  agent finishes unseen and it waits for the person. With every step
  archived or gone, the round ends into its summary.
- `web/src/components/NextWaitingQueue.tsx`: no origin state or *Lähtöön*;
  the last step's button is *Valmis* (*Done*), the phone counter is `n/N`
  over the steps, and ↑ is disabled when nothing walkable is behind.
- `App.tsx` no longer builds the origin step; Kokeelliset ominaisuudet card
  texts updated in both languages; Storybook *Production/Next waiting
  round* follows.

## Evidence

- `web/tests/next-waiting-row.spec.ts`: the line is absent while it is the
  person's turn, shown while the agent works (4 others, not itself), gone
  when the turn ends and back when the agent works again; the round is the
  four waiting ones without the start, ↑ is disabled at the first step, the
  start joins the round's end after its agent finishes unseen; on the phone
  the round is walked by tapping and *Valmis* ends it in the last
  conversation, not at the start. The second case returns to the start
  through the rail, keeps the bar there, and the round ends itself when its
  steps are archived; Mac keys ⌥. Passed three times
  (`OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=9650`).
- `web/src/app/nextWaiting.test.ts`, `NextWaitingQueue.test.tsx`: round
  without origin, step-back limit, ending without a target, the start
  joining later, archiving the step under the person. Web focused checks
  passed.
- Screenshots in `evidence/` (AVIF, light and dark): `lahto-desktop`,
  `kierros-desktop`, `kierros-phone`, `kierros-viimeinen-phone` (the last
  step with *Valmis*), `kierros-kayty-phone` (ended there with the note).

## Decisions for later review

- **The round's end stays where the person is.** After the last step
  *Valmis* (Alt+↓) ends the round in that conversation with the note
  *Kierros käyty: N hoidettu.*; ✕/Esc still end it without the note.
  Alternatives: end silently, or lead to the next waiting conversation
  outside the round. The note says the round is through without implying a
  destination, and the person goes on through the rail.
- **The start joins the round when it waits for the person.** When the
  agent it started from finishes while the person is elsewhere, it is in
  Sinun vuorosi and is appended to the round like any other late arrival.
  Alternative: keep it out of the round for good. Excluding it would be a
  special case of tracking; included, it is reached only because it waits,
  which is what the round walks.
- **The round's bar still shows in every conversation during a round,**
  also one whose agent waits. "Hidden while this conversation waits" is
  read as the start line: the round's steps are by definition conversations
  waiting for the person, and the bar is how the round moves on.
- **Switching the experiment on while the agent already works shows the
  line at once**, since there is no longer a latch that waited for the next
  confirmed run.
- **If the step under the person is archived and none was before it**, the
  round's place is before its first step: ↑ does nothing and Seuraava opens
  the new first step.
