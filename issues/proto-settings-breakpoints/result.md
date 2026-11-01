# Result: when the settings section list gives way

Prototype: `prototypes/taitekohdat.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`. Jari's
Finnish guide is `prototypes/NOTES.md`. The screenshots in
`prototypes/kuvat/` (device scale factor 2, AVIF) were made by
`prototypes/shots.mjs`. The same script clicks every control, the
frame's navigation, the drag handle and the chart in every direction
(light, dark, English, narrow rail), and the console stayed clean.

The frame is Open Habitat at a window width Jari can drag: the app
sidebar, then Settings with its own list and the Tili, Ulkoasu and
Kokeelliset sections, all in Finnish or English with the catalogues'
real texts. Its CSS is copied from `Settings.css`, `components.css` and
`ExperimentalFeatures.css`. Every `@media (max-width: N)` is written as
`@container vp (max-width: N)` on the frame, so the frame is the
window, and the breakpoint numbers are live controls. A hidden copy of
the frame is measured every 10 px from 360 to 1600 px, with the sidebar
open and narrow, and drawn as a curve of the content column's width. The
curve and its two summary numbers carry each direction's difference on
the default view (1000 px, sidebar open). The top of the page names it
in one line per direction.

## What the measurement showed about today

- The worst case is not Jari's 300 px but **163 px**, at an 810 px
  window. The app sidebar returns at 801 px and takes 296 px at once,
  while Settings keeps its list until 760 px. At that width the email
  breaks (*jari.mustonen@i / ki.fi*) and *Muokkaa Git-identiteettiä* is
  clipped (kuvat/02).
- Settings never gets wider than about 880 px: the app's `main` is
  capped at `--ah-app-max` (960 px) and the layer's padding grows with
  `4vw`. Above about 1250 px the content column narrows slightly as the
  window grows.
- In the Git identity row, the button goes under the name below about
  510 px of content. Below 400 px the `settings-main` container stacks
  every row. Neither rule is the problem; the column is.

## Directions (axis: which width decides the layout, and whether there is a step between)

| | Direction | Decides | 1000 px, sidebar open | Narrowest content beside the list (open / narrow sidebar) | Stack below (open / narrow) |
|---|---|---|---|---|---|
| – | **Nykyinen** | window ≤ 760 | list, content 338 px | 163 / 407 px | 770 / 770 px |
| 1 | **Ikkuna** | window ≤ 1140 | stack | 476 / 548 px | 1150 / 1150 px |
| 2 | **Asetusalue** | settings area ≤ 770 | stack | 495 / 490 px | 1170 / 900 px |
| 3 | **Kuvakkeet** | area ≤ 770 icons, ≤ 520 stack | icon list, content 528 px | 495 / 490 px (icons 427 / 428) | 890 / 560 px |

"Settings area" is the settings layer's content box, to the right of
the app sidebar. Stack means what the phone has today: the open section
with *← Asetukset*, or the list alone.

### Costs

- **1** stacks needlessly: with the narrow sidebar a 1100 px window
  has 870 px of settings area but shows no list (kuvat/04). Each window
  number is right for only one sidebar state.
- **2** has no intermediate step. In a 1000–1170 px window with the
  sidebar open, moving between sections goes through *← Asetukset*.
- **3** keeps navigation one click away, but 20 sections as bare icons
  are hard to tell apart: several share an icon (plug, key, mic and disk
  appear twice, once in Palvelimen ylläpito). It is also a third layout
  to keep and test.

## Host facts

- No server or contract change: this is CSS in the browser package.
- Direction 2 or 3: the settings layer (`.ah-settings-layer`, and its counterpart
  wherever Settings renders outside the layer) becomes
  `container: settings-area / inline-size`. A container cannot query
  itself, and `.s-page` is the element whose `flex-direction` changes,
  so the container is its parent. Every Settings rule now under
  `@media (max-width: 760px)` or `800px` that is about the settings
  column (ten blocks in `Settings.css`, and `ExperimentalFeatures.css` and
  `AccountKeys.css`) moves to `@container settings-area (max-width: 770px)`.
  `Account.tsx` also asks `matchMedia("(max-width: 760px)")` whether the
  list and section show together (search previews only then). That
  question becomes "is the page stacked", read from the layout, for
  example a `ResizeObserver` on the layer compared with the same 770,
  so CSS and script cannot disagree.
  The phone-only rules stay viewport media queries: layer padding, the
  close button's place and touch sizes.
- The stacked layout's rule that makes every row one column moves out
  of the stack. The existing `settings-main (max-width: 400px)` rule
  already does that by column width; on a 390 px phone the column is
  352 px, so phones look the same.
- Fractional widths matter: two adjacent container queries need a range
  (`520px < width <= 770px`) rather than `max-width`/`min-width` pairs,
  which left a gap at 520.5 px in the prototype.

## Recommendation

**Direction 2, at 770 px of settings area.** It fixes the cause rather
than the number: the list appears only when at least 480 px of content
fits beside it, and that holds with the sidebar open, narrow, or with
anything else that later takes room from the left. One container replaces
a dozen viewport rules, so the phone and the narrow desktop window
follow one rule. Direction 1 is a smaller diff but is right for only one
sidebar state. Direction 3's icon list is worth revisiting only if the
sections get distinct icons; with today's duplicates it trades the
back link for guessing.

## Questions for Jari

1. Which direction: 1 (window raised to 1140), 2 (settings area 770) or
   3 (icon list between)? I recommend 2.
2. Is 480 px of content the right minimum beside the list? A smaller
   value keeps the list longer (420 px keeps it down to about a 1090 px
   window with the sidebar open), at the cost of more two-line names.
3. In the stack on a desktop window Settings opens straight into the
   section with *← Asetukset*, as on the phone today. Is that enough, or
   should the stack show the section's name as a menu for jumping
   directly?

No production code was changed.
