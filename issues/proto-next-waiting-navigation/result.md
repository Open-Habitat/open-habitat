# Result: moving to the next waiting conversation and back

Round 1, 29.–30.10.2026. Prototype:
`issues/proto-next-waiting-navigation/prototypes/siirtyma/index.html`
(hand-written source `page.html`, assembled by `build.mjs`, checked by
`verify.mjs`). Jari's guide is in [NOTES.md](prototypes/siirtyma/NOTES.md).
Screenshots (AVIF, device scale factor 2) are in `prototypes/siirtyma/evidence/`.

## What is wrong today

The *Sillä aikaa* line works (Jari, pilot.511). The movement around it has
three gaps, all reproduced in the **Nykyinen** comparison:

- **Alt+↑ is invisible and steps back, not home.** Nothing in the target says
  that a way back exists or where it leads. `WaitingWalk.back`
  (`web/src/app/nextWaiting.ts:50`) rewinds one step, so after two moves it
  goes to the middle conversation instead of the one whose agent is working.
- **A read reply stalls the walk.** `NextWaitingDock`
  (`web/src/app/NextWaitingDock.tsx:43`) latches the line on the host's
  working confirmation. Open a conversation that only had an unread reply and
  read it: its agent does not work, so no line appears and Alt+↓ does nothing
  (`evidence/4-nykyinen-luettu-ei-jatkoa-*`).
- **No way back on a phone.** The only return is a key. Browser Back works
  because `navigate` pushes history, but nothing points to it.

## Axis and directions

**Axis: how the person moves to the waiting conversation and how they come
back.** The story is the same in every direction. You are in *Kirjautumisen
virheilmoitukset* while its agent works. Three conversations wait: one asks a
question and two have unread replies. Page events finish the origin, answer
the question on another device, and bring a new reply in mid-walk.

| Direction | Move | Return | Where the return shows | Phone |
| --- | --- | --- | --- | --- |
| **Paluu** | Today's line, Alt+↓ | Always to the walk's origin; returning ends the walk | A line above the offer: *Takaisin · origin · työskentelee 0:42* (Alt+↑). It turns to the your-turn colour with *Palaa* when the origin finishes. The offer line sits below it (Alt+↓), so position matches the arrow | Both lines tappable |
| **Jono** | *3 odottaa sinua · Käy läpi* starts a round | Alt+↑ steps back one; after the last step Alt+↓ goes back to the origin and says *Kierros käyty: 3 hoidettu*; Esc or ✕ ends the round | The whole round as a bar above the composer: origin, then the waiting ones in rail order, with ✓ for handled and strikethrough for handled elsewhere. It stays visible also while the conversation asks something | Bar shrinks to *‹ ●●○○ 1/3 · title · Seuraava ✕* |
| **Rinnakkain** | *Avaa viereen* opens the waiting one in a column beside the current one, with its own composer and focus | Close the column (Esc, Alt+↑, ✕); focus returns to the origin's composer; ⤢ opens it fully | The origin never leaves the screen | A bottom sheet over the origin, whose title and state stay in the top bar |
| **Nykyinen** | Line, Alt+↓ | Alt+↑ one step back, invisible | Nowhere | No return |

In Paluu and Jono, a conversation opened from the walk offers the next one as
soon as it no longer needs the person: a question has been answered or a
reply has been read. Nykyinen keeps production's working-latch.

`verify.mjs` builds the file and checks every direction at 1280 and 390 px,
in light and dark. It checks:

- the offer shows while the agent works
- Paluu: the return line in the target, no offer while the target asks, the
  next offer after answering, the ready state when the origin finishes, the
  offer after a read reply, and Alt+↑ returning to the origin and ending the
  walk
- Paluu: an offer handled elsewhere moves on and says so once
- Jono: Alt+↓ starts the round, the queue shows while the target asks, Alt+↑
  steps back, the end leads to the origin with the count, handled elsewhere is
  struck through, and Esc ends the round
- Rinnakkain: the pane opens with focus, the next offer appears in the pane,
  the origin is read when visible (desktop) and unread when covered (phone),
  Esc closes the pane and returns focus, and ⤢ opens the conversation fully
- Nykyinen: nothing shows in the target, a read reply stalls the walk, and
  Alt+↑ steps back one
- no horizontal overflow in the top bar, dock, pane head or composer
- the picker passes `picker-check`
- no console errors and no network requests

Result: pass. The check runs 28 direction/size/theme cases and saves 51
screenshots.

## Host facts each direction needs

Every direction reads only what the rail and the conversation view already
have. **No new endpoint, store or contract field.**

| Fact | Exists? | Where |
| --- | --- | --- |
| Conversations waiting for the person (Sinun vuorosi), in rail order | Yes | `useRailNow` / `railNow` (`web/src/app/WorkspaceRailView.tsx:78`, `web/src/app/railNow.ts`) |
| Question vs. unread reply, age | Yes | `AgentNavModel.question`, `changedAt` (`web/src/components/Navigation.tsx:447`) |
| This conversation's agent works (host-confirmed) | Yes | `presentation.activity === "working"` passed to `NextWaitingDock` (`web/src/app/BrowserConversation.tsx:2441`) |
| Origin's live state while elsewhere (Paluu's line, Jono's first step) | Yes | The origin's row in the same rail model (activity, question, changedAt); the timer is `changedAt` |
| The walk: visited conversations, origin | Yes, tab memory | `WaitingWalk` (`web/src/app/nextWaiting.ts`), fed by `useWaitingWalk` (`web/src/app/App.tsx:1153`). Paluu adds its first step as the origin; Jono adds a frozen step list and a position. Both are memory of this tab, like the walk today |
| "Read" for an unread reply | Yes, tab-local | As today; another device's reading does not move the offer |
| Two conversations live on one page (Rinnakkain) | Data yes, view no | One event journal per tab feeds every conversation (`web/src/app/conversationJournal.ts:43`), and the store subscribes per conversation (`web/src/app/conversationStore.ts:206`). But `BrowserConversation` (2,593 lines) is mounted once per route (`?conversation=`, `web/src/app/App.tsx:2319`). Its `Composer` registers document-level key handlers (`web/src/components/composer/Composer.tsx:995`), so two of them would both answer Cmd+P, Alt+Enter and dictation. This is a large UI change, not a host change |

## Recommendation

**Paluu.** Reasons:

- It fixes exactly the three gaps without adding a new mode. The return is a
  visible line that names its target and tells its state. It goes where the
  person left work running, and it works by tapping on a phone.
- The arrow keys map to visible positions: the return line above (↑) and the
  offer below (↓). Learning the keys becomes optional.
- The origin turning to the your-turn colour answers the question the person
  actually has while away: "is my thing done yet?"
- It is a small change on top of what exists:
  - `WaitingWalk` gains an origin, and `back` goes to it.
  - `NextWaitingDock` relaxes its latch for conversations opened from the
    walk.
  - `NextWaitingRow` gets a second line.

Jono is the runner-up. It suits a person clearing a backlog, and seeing the
whole round is useful. But it adds a mode with its own start and end, and its
bar takes room above the composer even while the conversation asks
something. Its stepwise Alt+↑ also has the same "back to where?" question as
today, only now with an answer on screen. Rinnakkain feels best on a wide
screen, because nothing moves. But it needs two full conversation views on
one page, its phone form hides the origin under a sheet, and at 1280 px each
column is narrow for code and tool output. It is worth its cost only if
"answer something else without leaving" becomes a goal of its own.

Implementation sketch if chosen:

- **`nextWaiting.ts`**: `WaitingWalk` records `origin` on the first
  `forward`. `back()` returns the origin and clears the walk, and the offer
  skips the origin.
- **`NextWaitingDock.tsx`**: shows the offer when `engaged ||
  (openedFromWalk && !needsYou)`. It renders a return line whenever the walk
  has an origin other than this conversation, and Alt+↑ is taken only then.
- **`NextWaitingRow.tsx`**: gains the return line, with the origin's ball
  and state from the same rail model.

## Decisions for later review

- **Return goes to the origin, not one step back.** Alternative: production's
  step back (Jono keeps it). The person left work running in the origin; the
  intermediate conversations have just been handled.
- **Returning ends the walk.** Alternative: keep the walk, so a second Alt+↓
  continues where it left off. Ending it keeps "Takaisin" from pointing at a
  stale origin. The visited set is dropped with it, so a later Alt+↓ offers
  from the top of the rail again.
- **A conversation opened from the walk offers the next one once it no longer
  needs the person.** Alternative: production's working-latch only. Without
  this, reading an unread reply stalls the walk.
- **The offer skips the origin** even when the origin finishes and enters
  Sinun vuorosi. The return line already offers it, and offering it twice
  would make the two lines compete.
- **The return line takes the your-turn colour (`--ah-turn`) when the origin
  waits.** Alternative: the accent of the offer line. It is the rail's ball
  colour for the same fact.
- **Order stays the rail's order** in every direction, as in production.
- **Rinnakkain on a phone marks the origin unread while the sheet covers it**,
  and read when the sheet closes. Desktop shows it, so it is read. "Seen" means
  what was on screen.
- **Jono's round is frozen at start**, and conversations that start waiting
  later are appended at the end. Alternative: rebuild it live, which would
  move steps under the person's cursor.
- **Alt+↓/Alt+↑ stay global, also while typing**, as in production. On macOS,
  Option+↑/↓ moves the caret to a paragraph start or end in a text field. Asked
  in NOTES; the alternative is to take the keys only when the field is empty.
- **The picker sits at the top** (`data-position="top"`, the one change
  PICKER.md allows), because the work is the dock above the composer.
  Screenshots hide the picker (`shot=1`).
- **Single-word direction names** (Paluu, Jono, Rinnakkain) so the shared
  picker does not wrap at phone width.
