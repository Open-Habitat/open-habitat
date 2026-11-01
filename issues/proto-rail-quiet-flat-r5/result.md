# Result: how the open conversation's row is emphasised in Hiljaiset

Prototype: `prototypes/hiljaiset-r5.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`. It reuses
round 4's page and world, fixed to round 4's riff 1 **Ruudut**. Jari's
Finnish guide is `prototypes/NOTES.md`. The screenshots in
`prototypes/kuvat/` (device scale factor 2, AVIF) were made by
`prototypes/shots.mjs`. The same run clicks every control in every riff
(desktop, phone, dark with *Paljon*), and the console stayed clean.

Both of Jari's corrections are in every riff. The popover's foot text
*Näkyy heti listassa. Seuraa sinua kaikille laitteille.* is gone, leaving
only *Valmis* (`kuvat/17`). The stored order survives narrowing to one
workspace and returning to Kaikki (`kuvat/18`: *Työtila* → deutschpad →
Kaikki shows *Työtila* again).

The top of the page lists one line per riff. Under it, **Rinnakkain** draws
all five riffs side by side with no click needed. The rows are desktop
light, desktop dark, phone light and phone dark. Each cell holds the first
six Hiljaiset rows with one row hovered, then the folded section with the
open row and the workspace pills. Below that is the full interactive app
for the picked riff.

## Riffs (axis: how the open conversation's row is emphasised)

| | Riff | Open row | Folded pill of its workspace |
|---|---|---|---|
| 1 | **Viiva** (round 4's) | white row, hairline, 3 px accent bar on the left | accent border |
| 2 | **Rengas** (round 4's) | white row, 1.5 px accent ring all round | accent ring |
| 3 | **Työtilan väri** (round 4's) | as 1, but the bar is the workspace icon's colour | border and tint in that colour |
| 4 | **Täyttö** (new) | no line; soft accent fill, accent text | soft accent fill |
| 5 | **Kieleke** (new) | the row runs to the rail's edge in the conversation's background and covers the edge, like a tab; on the phone (a drawer) a bordered row instead | conversation background, strong border |

### Costs

- **1 · Viiva**: the least new, and readable in both themes and on both
  row heights. The bar is thin (3 px), so it rests on the white fill and
  the bold title as much as on itself.
- **2 · Rengas**: the strongest outline. Folded, a ringed row sits right
  above a ringed pill, which doubles the noise. Production's keyboard
  focus ring is also an accent outline, so the two would be hard to tell
  apart.
- **3 · Työtilan väri**: ties the row to its workspace, but the emphasis
  changes colour from one conversation to the next. Some workspace colours
  (pink, amber) read like the *your turn* or error colours, and a pale
  hue nearly vanishes in the dark theme.
- **4 · Täyttö**: the most visible from afar, especially in dark. It uses
  the same soft accent as selected tiles and the person's own messages,
  so turquoise starts to mean several things in the rail.
- **5 · Kieleke**: the most meaningful (the row *is* the open view's tab)
  and the quietest. In the light theme the conversation's background is
  only slightly lighter than the rail, so it leans on the hairline. It has
  no tab form on the phone, where the rail is a drawer over the
  conversation.

## Host facts

None new. The emphasis is browser styling of the row the route already
marks as current. Round 4's facts stand: order and workspace are account
preferences, and the fold is per device.

## Recommendation

**1 · Viiva.** It stays readable on desktop and phone, in light and dark,
and is distinct from hover and from focus. It is the emphasis Jari has
already seen next to Ruudut, and its pill marking stays quiet. If Jari
wants the open row to stand out more, 4 · Täyttö is the stronger
alternative. Kieleke is the most elegant on desktop, but it needs a
separate phone form.

## Questions for Jari

1. Which emphasis: 1 Viiva, 2 Rengas, 3 Työtilan väri, 4 Täyttö or 5
   Kieleke? I recommend 1.
2. Should the folded pill of the open conversation's workspace be marked at
   all, or is the open row above it enough?

No production code was changed.
