# Result: the conversation header in one row on a phone, with all five facts

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

## Round 3 (3.11.): how one phone row carries all five

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

## Recommendation

**Direction 1, Alarivi.**

- It is the only direction that keeps a readable title on a phone: about
  205 px at 390, against 70–80 px in the others. At 360, directions 2 and 3
  leave three or four letters of the title. The title is what tells you which
  conversation you are in.
- The five show as words, not codes: the repository's real name and
  `Opus 5.5`. In 2 and 3 you have to learn `AU` and `Opus`. At 360 the
  name shortens to `auri…`, but its start is still the name.
- The quiet line reads as one set. Round 1's problem was uneven controls
  on the second row, and this line has no boxes at all. It costs 3 px of
  height over one row.
- On a desktop I would keep today's row (picture 18), not direction 1's
  two-line block (14). The desktop already shows all five in full, and the
  one-row decision was about the phone.

## Questions for Jari

1. **Which form: picture 02 (Alarivi), 05 (Yksi siru) or 09 (Omat merkit)?** I recommend 02.
2. **Desktop: picture 14 (the same line under the title) or 18 (today's row)?** I recommend 18.
3. **Status: is the dot enough (02, the same as the desktop), or should the
   word (*Työskentelee*, *Odottaa sinua*) show in the row?** I recommend the
   dot. Its word is one tap away, and the conversation list shows the same state.

No production code was changed.
