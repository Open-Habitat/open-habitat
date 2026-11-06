# Result: the conversation header on a phone, its bottom row and what it opens

## Round 1 (2.11.), decided

Prototype: `prototype/otsakkeen-toinen-rivi.html`, guide `prototype/NOTES.md`,
source `design-system/prototypes/rounds/2026-11-02-otsakkeen-toinen-rivi/`.
Jari chose direction 3, **one row** (3.11.). Two findings from that round
still apply to the implementation:

- **The outlined H↻ box is a disabled action that escaped the phone rule.**
  A disabled `ControlButton` is wrapped in the tooltip's `_disabledTrigger`
  span. The header's `.ah-agent-topline > :is(.ah-retitle, …)` rules use a
  direct-child selector, so they miss the wrapped button. Give the wrapper a
  class, or match it the way `frame.css` does with `:has()`.
- **The model is shown twice only before the first message.** Before that
  message the composer carries `ComposerModelPicker`. Once the conversation
  runs, the header's chip is the only picker. One row therefore moves the
  running conversation's picker into the composer.

## Round 2 (3.11.): the split, redone

`prototype-2/` riffed on which items stay in the row and which move into ⋯,
grouped by role. Jari had it redone (3.11.). Its directions hid Git, the
context, the workspace or the model in ⋯ on the phone, but the phone must
give the same information as the desktop. Two choices carry over into
round 3: the one-off actions go into ⋯, and ⋯ holds actions only.

## Round 3 (3.11.): how one phone row carries all five, decided

Prototype: `prototype-3/otsakkeen-viisi.html` (Jari's guide in Finnish:
`prototype-3/NOTES.md`). Source:
`design-system/prototypes/rounds/2026-11-03-otsakkeen-viisi/`. It uses the
same machinery as round 2: production's page and stylesheet are captured
from the synthetic lab, and the directions are laid over the header.

```
OH_PORT_BASE=5964 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-otsakkeen-viisi/capture.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-otsakkeen-viisi/shoot.mjs
```

**The five** (`prototype-3/kuvat/00-inventaario-1440.avif`, today's desktop row):

1. the workspace (repository) name;
2. the activity, a dot whose word shows on hover;
3. Git (↑ unpushed, ↓ incoming, ● changed);
4. the context in use, a ring and a percentage (shown only once the
   context has been used);
5. the model.

Today's phone shows 2–5 on a second row and moves the workspace into ⋯.

**Axis: the form the five take in the phone's single row.**

| | Direction | Phone row (390, running) | Tap | Title at 390 / 360 | Desktop 1440 |
|---|---|---|---|---|---|
| 1 | **Alarivi** | ● title, below it `aurinkokello · ↑2 ●4 · ◯ · Opus 5.5` | the line opens all five in full | 206 / 176 px; header 56 px | the same two-line block; panels and actions stay in the row |
| 2 | **Yksi siru** | title, then one outlined chip `● AU ↑2 ●4 ◯ Opus` | the chip opens all five in full | 80 / 50 px; header 53 px | the chip spelled out: `● aurinkokello ⎇ ↑2 ↓1 ●4 ◯ 6 % Opus 5.5 · Medium` |
| 3 | **Omat merkit** | `AU` with the activity ball, title, `↑2 ●4`, ring, `Opus` | each mark opens its own value | 70 / 40 px; header 53 px | today's row, unchanged |

All three directions:

- ⋯ lists actions only. On a phone that means *Avaa työtila*, *Editori*,
  *Pääte* (plus *Tiedostot* or *Opas* when present) and the conversation's
  one-off actions. The panels leave the phone's row to make room.
- The values the row shortens (incoming commits, branch, percentage,
  thinking level) are one tap away. Each row of that layer leads where the
  chip leads today.
- The model is in the header, so before the first message the model shows
  twice, here and in the composer's picker. Round 1's finding still applies:
  once the conversation runs, the header is the only place for it.

`shoot.mjs` checked 48 views: four views × 390/360/1440 × light/dark ×
new/running. In every direction view:

- all five facts are visible in the header (the context once there is any);
- on a phone the header is one row with every item inside it, and no
  panel or one-off action is in it;
- a tap opens the full values (all five in 1 and 2; the tapped one in 3),
  and Esc closes them;
- ⋯ contains no fact.

The console is clean, there are no network requests, and `picker-check`
passes. The header is 53–56 px on a phone, compared with 97–105 px today.

### Host facts the view assumes

None new. The header already has the workspace name, the activity, the Git
summary, the context tokens and window, and the model. The workspace's
initials come from the same `initials()` the rail uses. New catalog
entries in both languages: the role words in the value layer (*Tila*,
*Työtila*, *Git*, *Konteksti*, *Malli*) and the context value text
(`12k / 200k tokenia`).

**Decided (Jari 6.11.):** direction 1, **Alarivi** (picture 02). The status
shows as a dot only, and the desktop stays today's row (picture 18).

## Round 4 (6.11.): what the bottom row opens

Prototype: `prototype-4/alarivin-valikko.html` (Jari's guide in Finnish:
`prototype-4/NOTES.md`). Source:
`design-system/prototypes/rounds/2026-11-06-alarivin-valikko/`. It uses
round 3's machinery: the lab's production page and stylesheet, with round 3's
chosen row laid over the phone's header. This time the capture also keeps
production's own phone places: the ⋯ menu popover, the Git sheet, the model
card and the context page. The riffs open those places and build nothing of
their own.

```
OH_PORT_BASE=6260 scripts/lab.sh start && OH_PORT_BASE=6260 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-alarivin-valikko/capture.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-alarivin-valikko/shoot.mjs
```

**Axis: what a tap on the bottom row opens, where it opens and how it closes.**
The row is the same in every riff (round 3's picture 02), and every riff
starts open on the default view.

| | Riff | Tap target | What opens, where | Closes | Detail of a fact |
|---|---|---|---|---|---|
| A | **Valikko** | the whole line | production's menu popover under the line: the status (dot and word) as its heading, then workspace, Git, context and model, each with its full value | a tap outside it, the line again, Esc | the row leads to that fact's place (2nd tap) |
| B | **Alalaatikko** | the whole line | production's phone Git sheet from the bottom, carrying all five: the status on top, then workspace, context and model as rows, then the Git details in full | ✕, the scrim, dragging the handle down, Esc | Git is already in the sheet; context and model go one tap further |
| C | **Omat napit** | each part of the line | the part's own place, as its desktop chip opens it: the Git sheet, the context page, the model card, the workspace | each the way production closes it (✕/scrim/Esc, back button, a tap outside) | one tap |

Today's places on a phone: the Git chip opens a bottom sheet with a handle
and ✕, the context ring replaces the conversation with the context page and
its back button, and the model chip opens a card at the bottom. The status
dot shows its word on a tap.

`shoot.mjs` checked 32 views (four views × 390/1440 × light/dark ×
running/new). In every riff on a phone:

- the header has the bottom row under the title, the status only as a dot,
  and is 56 px high, against 97–105 px today;
- the riff starts with its place open, A's menu lists workspace, Git, context
  (once used) and model under the status heading, B's sheet carries the rows
  and the Git details, and C's line has the four buttons;
- each closing route the table names works, and each row or button reaches
  its fact's production place;
- ⋯ lists no fact;
- on the desktop, every riff is today's production row with nothing open.

The console is clean, there are no network requests, and `picker-check`
passes.

### Host facts the view assumes

None new. All five facts and all four places already exist in production.
B's sheet is a new composition of the Git sheet: it needs the status, the
workspace path, the context tokens and window, and the model in the Git
layer's component, all of which the header already has. A's and B's role
words (*Työtila*, *Git*, *Konteksti*, *Malli*), A's details (*Näytä tiedot*,
*Avaa erittely*, *Mallin tiedot*) and the context value text
(`12k / 200k tokenia`) are new catalog entries in both languages. The lab
knows no model and cannot read the context breakdown, so the pictures show
Opus 5.5 · Medium and the context page's "could not read" text.

## Recommendation

**Riff A, Valikko.**

- The line is one large tap target. In C each part is a 26 px high button,
  and the workspace name shortens to `aurin…` to make room for the buttons'
  padding. That is below the 44 px touch size, on a line Jari reads mainly
  on a phone.
- One tap shows every value in full without leaving the conversation (the
  conversation stays visible under the menu), and each row leads where the
  desktop chip leads. B shows the most, but the sheet covers most of the
  conversation, and Git's details fill most of it whether or not Git was
  what you wanted.
- It keeps round 2's division: ⋯ is a menu of actions and the bottom row is a
  menu of facts, in the same production menu form.
- The cost is a second tap for details (Git's commits, the context
  breakdown). C saves that tap, which matters if Jari opens Git more often
  than he reads the values.

## Questions for Jari

1. **Which: picture r4-01 (A Valikko), r4-05 (B Alalaatikko) or r4-09 (C Omat napit)?** I recommend r4-01.
2. **New conversation (r4-03): the model shows in the row and in the
   composer's picker.** Should the row leave the model out until the first
   message? I recommend leaving it out. The composer's picker is where the
   model is chosen then, and round 1's issue was this duplicate.

No production code was changed.
