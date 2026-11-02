# Result: prototype round, the header's second row

Prototype: `prototype/otsakkeen-toinen-rivi.html` (Jari's guide in Finnish:
`prototype/NOTES.md`). Source:
`design-system/prototypes/rounds/2026-11-02-otsakkeen-toinen-rivi/`.

- `capture.mjs` records the synthetic lab's conversation page in Finnish: a
  new empty conversation and a running one, at 390 and 1440 px. It saves the
  rendered markup, the open ⋯ menu, the production stylesheet and the
  `00-nyt-*` screenshots.
- `build.mjs` shows each view in an iframe as wide as the device, so
  production's own `max-width: 800px` rules decide the layout.
- `frame.css` and `frame.js` lay the directions over it.
- `shoot.mjs` builds the page, checks it and takes the screenshots.

The views are production markup and CSS, not a copy, so they look like
Habitat. The lab's unknown model is shown as "Opus 5.5 · Medium".

Rebuild (the lab dies with the shell that started it):

```
OH_PORT_BASE=5874 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-02-otsakkeen-toinen-rivi/capture.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-02-otsakkeen-toinen-rivi/shoot.mjs
```

## What the lab showed

Jari's screenshot was not on Birch or Alder (`/var/tmp/oh-r54/` did not
exist), so the round started from the issue text and the lab. Opening a new
conversation in the lab at 390 px reproduces both of his observations.

- **The outlined box is a disabled action that escaped the phone rule.**
  *Luo uusi otsikko* is disabled in an empty conversation. Since the shared
  tooltip change (8d765d2b), a disabled `ControlButton` is wrapped in a
  `_disabledTrigger` span. The phone CSS hides
  `.ah-agent-topline > :is(.ah-header-recap, .ah-retitle, …)` with a direct
  child selector, so the wrapped button escapes it. It gets row 2's order
  and shows its disabled surface: the H↻ box. A disabled *Tee tilannekatsaus
  nyt* would do the same, which is probably the second box Jari saw. On a
  desktop the same wrapper keeps a grey square among quiet icons. This
  happens in every direction, so the implementation fixes the selector
  whichever is chosen. The `:has()` rule in `frame.css` shows one way, and a
  class on the wrapper is cleaner.
- **The model is shown twice only before the first message.** In an empty
  conversation the composer carries the model picker
  (`ComposerModelPicker`) and the header a static `ModelChip`. Once the
  conversation runs, the header chip is the only picker, so it cannot be
  dropped without moving the picker.

## Directions

| | Direction | Phone row 2 | Desktop | Model in a running conversation | Header height at 390 |
|---|---|---|---|---|---|
| 1 | **Yksi ikonirytmi** | plain icons with numbers, 40 px like row 1, one gap, no borders | today's quiet row; the chips' height is set to the icons' 32 px | stays on row 2, at its end under ⋯ | 93 px (today 97/105) |
| 2 | **Tasakokoiset sirut** | every item the same outlined pill, 32 px; the activity is a chip with its word (*Odottaa sinua*), which stays off the phone row while the model is there | the same outlined chips | stays, as a chip | 97 px |
| 3 | **Yksi rivi** | no row 2: the activity dot before the title; Git and context in ⋯'s new Tila section | the same: title, workspace, panels, ⋯; Git, context and the one-off actions in ⋯ | moves to the composer chip, always | 53 px |

All three drop the header's model in a new conversation and hide the
disabled-action box.

Checked by `shoot.mjs` in 48 views: four views (three directions and today)
× 390/360/1440 × light/dark × new/running. In every view no header item
leaves the header, and every view opens and closes ⋯ (Esc) wherever ⋯ is
shown. In the three directions:

- the state items share one height;
- the model shows exactly once;
- no disabled action sits on row 2;
- the phone header is at most two rows, and one row in direction 3;
- in direction 3, ⋯ has the Tila section.

The console is clean, there are no network requests, and `picker-check`
passes. On a phone the fixed picker needed a round-local
`white-space: nowrap`, because at `left: 50%` it gets half the screen and
wraps its labels. Proposal for `lib/picker.css`: the same rule there.

## Host facts the view assumes

None new. Git counts, the context tokens, the activity word and the model are
already in the header's props. Direction 3's Tila rows reuse them as text and
would open the same layers as the chips (Git details, context page). Moving
the running conversation's model picker into the composer (direction 3)
reuses `ComposerModelPicker`, which today appears only before the first
message.

## Recommendation

**Direction 1, Yksi ikonirytmi**, with the selector fix.

- It answers the complaint directly: one height, one style, one gap,
  aligned with row 1's icons. It also keeps the earlier round's two-row
  height gain and improves on it slightly (93 px).
- It matches the desktop's quiet look, which Jari chose in
  proto-conversation-header round 2 (chips without borders until hovered).
  The phone and desktop then speak one language. Direction 2 brings back the
  borders that round removed, and its phone row is already full at 360 px.
- Direction 3 saves another 40 px but hides the Git counts behind ⋯. They
  are the header's reminder of unpushed work, and the Yläpalkissa decision
  put them in the header on purpose.

## Questions for Jari

1. **Direction 1 or 3?** Is the second row worth its 40 px on a phone, or
   are Git and the context enough behind ⋯? I recommend 1.
2. **Should the model always live in the composer chip**, as in direction 3,
   with 1 or 2 as well? Then the model has one place in every situation, and
   a running conversation's phone row 2 is only activity, Git and context. I
   recommend yes, as a follow-up after this fix, because it moves the model
   picker for a running conversation.
3. In direction 1, should the activity show its word on a phone (*Odottaa
   sinua*) as in direction 2, or stay a dot with its tooltip? I recommend
   the dot: the rail's ball already says the same.

No production code was changed.
