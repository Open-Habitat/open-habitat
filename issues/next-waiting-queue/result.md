# Result: next waiting conversations as a queue (Jono)

Implemented 30.10.2026 behind the existing experimental switch
`next-waiting-row`; with it off nothing renders and no key is taken.

## What changed

- `web/src/app/nextWaiting.ts`: `WaitingWalk` (visited list, one-step
  `back`) is replaced by `WaitingRound`, tab memory per signed-in person.
  It freezes the round at its start (origin, then Sinun vuorosi in rail
  order), appends conversations that start waiting later, tracks the
  current step and which steps were opened in the round, and ends past the
  last step with *Kierros käyty: N hoidettu*. A subscribable store, so the
  bar re-renders when the round changes without a navigation (✕, Esc, the
  note timing out).
- `web/src/app/NextWaitingDock.tsx`: outside a round the line offers
  *N odottaa sinua · Käy läpi* once the host confirms the agent works (the
  same latch as before); during a round the bar shows in every
  conversation, also one that asks or whose reply was only read. Alt+↓
  next / start, Alt+↑ one step back (only when there is a step back), Esc
  ends the round.
- `web/src/components/NextWaitingQueue.tsx` (new) and `NextWaitingRow.tsx`
  / `.css`: the bar and the start line, with the phone form
  *↑ ●●○○ 1/2 · nimi · Seuraava ✕* below 800 px. Storybook:
  *Production/Next waiting round*.
- `App.tsx` gives the dock the rail's Sinun vuorosi and Käynnissä (for the
  origin's live ball) and this conversation as a step.
- Kokeelliset ominaisuudet card and settings search describe the round.

The prototype's three production gaps:

1. **Invisible step back**: the bar shows the whole round, the current step
   and a ↑ (Alt+↑) button that is disabled at the origin.
2. **A read reply stalls the walk**: the bar does not depend on the
   conversation's agent working; it stays and Alt+↓ moves on.
3. **No return on phone**: the compact bar has ↑, Seuraava/Lähtöön and ✕ as
   tappable buttons.

No host endpoint, contract field or store: everything is derived from the
rail model and this tab's round, as `result.md` of
`proto-next-waiting-navigation` concluded.

## Evidence

- `web/tests/next-waiting-row.spec.ts` (rewritten): off shows nothing; on,
  the start line after the host's working confirmation; Alt+↓ starts the
  round in rail order; the read step stays in the round and Alt+↓ goes on;
  Alt+↑ and the ↑ button step back to the origin, where ↑ is disabled; Esc
  ends the round; on a 390 px viewport a new round is walked by tapping,
  steps back by tapping, and *Lähtöön* returns to the origin with the note.
  Axe on the line and on the bar. Passed.
- `web/src/app/nextWaiting.test.ts`: round order, step back limit, handled
  here vs. elsewhere and skipping the latter, the end and its count,
  appending late arrivals, saying "handled elsewhere" once.
- `web/src/components/NextWaitingQueue.test.tsx`: ↑ disabled at the
  origin, Lähtöön when only handled-elsewhere steps remain ahead.
- Screenshots (device scale factor 2, `OH_VISUAL_CAPTURE=1`, converted to
  AVIF) in `evidence/`: `lahto-desktop-*` (the start line),
  `kierros-desktop-*` (the bar in a read step), `kierros-phone-*` (compact
  bar), `kierros-kayty-phone-*` (back at the origin with the note), each
  light and dark.

## Decisions for later review

- **Esc yields to what already owns it.** The composer's Esc stops a working
  agent (as in Pi's TUI), and dialogs, menus and lists close first; only an
  Esc nobody else took ends the round. Alternative: Esc always ends the
  round first. Stopping an agent by mistake is the costlier error, and ✕ is
  always there.
- **"Handled elsewhere" is derived in the tab**: a step that stops waiting
  without having been opened in this round is struck through and said once;
  one opened here gets ✓. Alternative: a host fact of which device answered.
  None exists and the tab's own knowledge is enough for the distinction the
  person sees.
- **Opening a step of the round by any route** (rail included) moves the
  round's place to it. Opening a conversation outside the round keeps the
  bar with its last place, so the way back is still on screen.
- **The start line keeps the working latch.** Outside a round, a
  conversation whose agent did not work in this visit offers nothing, as in
  the prototype's Jono; the read-reply fix applies within the round.
- **The old Alt+↑ outside a round is gone.** Outside a round Alt+↑ stays the
  text field's own key.
- **Terminal conversations** (`/agents/…`, read-only history) and
  conversations the browser does not control show no bar, as the old walk
  showed no line there. Their step stays in the round; the bar is back in
  the next browser conversation. Showing it in the read-only view is a
  separate change if wanted.
- **Turning the switch off mid-round** hides the bar; the round stays in the
  tab's memory and returns if the switch is turned back on.
- **Alt+↓/Alt+↑ stay global, also while typing**, as before (the prototype's
  open Mac question about Option+↑/↓ in a text field is unchanged).
