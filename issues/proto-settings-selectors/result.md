# Result: settings selectors as one family

Prototype: `prototypes/valitsimet.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py` (design-system
tokens and fonts inlined). Jari's Finnish guide is `prototypes/NOTES.md`.
The screenshots in `prototypes/kuvat/` (device scale factor 2, AVIF) were made
by `prototypes/shots.mjs`, which also clicks every segment, menu, stepper and
typed value in every direction, in both languages, both themes and both
widths; the console stayed clean.

The page shows a desktop settings area and a 390 px phone side by side, on
real rows: Ulkoasu (Teema, Kieli, Viimeisimmät keskustelut), Tilannekatsaus's
Katsauksen laajuus with Oma's three steppers (messages, tokens, words) and
Agentin työ and Työtilan editori. Labels come from the production catalogs in
both languages; language names stay native. A *Mitattu* table under the
frames reports each control's size and whether a segmented control wraps.

## Baseline, and why Kieli wraps

The baseline copies `Controls.module.css` (`.segmented` is `inline-flex` with
`flex-wrap: wrap`, segments at `inline` size, 26 px), `NumberControls.css` and
`Settings.css` (`.s-row` is `minmax(160px, 1fr) minmax(0, auto)`). Two things
together produce what Jari saw:

- The value column gets only what is left beside a 160 px label. With a
  760 px settings area (about a 1040 px window beside the rail) Kieli in
  English needs 299 px and gets 256, so it wraps and *English (UK)* falls
  alone onto a second row. In Finnish (*Järjestelmä*) Teema wraps too.
- Teema and Agentin työ put the `Segmented` straight into the row grid
  (`Account.tsx`), so it stretches as a grid item, while Kieli sits in
  `.s-val` and keeps its own width. On the phone Teema is therefore full width
  (330 px) and Kieli is not (299 px).

The stepper's number is right-aligned in a 64 px field between 26 px
buttons, and Viimeisimmät keskustelut has no unit.

## Directions (axis: how segment, stepper and choice of many sit on a settings row)

| | Direction | Segment | Choice of many (Kieli, Laajuus) | Stepper |
|---|---|---|---|---|
| – | **Lähtökohta** (main) | 26 px, wraps freely | segmented | `[− 12 +]` at 26 px, number right-aligned, unit inside |
| 1 | **Yksi sarake** | 32 px, equal segments, every control in a card as wide as the widest (subgrid); 2 × 2 when too narrow | equal segments | stretches to the column, number and unit centred |
| 2 | **Valikko monelle** | 32 px, never wraps; a row whose control does not fit puts it under the label | menu button that keeps the width of its longest option; options with notes; bottom sheet on the phone | compact `[− 12 +]` at 32 px, number centred, unit after the box |
| 3 | **Luettelo** | always under the label, full width, equal segments | radio list with each option's note | field with unit, then separate − and + buttons |

Common to 1–3: a number always names its unit (*5 conversations*), and a
settings row uses the `row` control size (32 px, 40 px on the phone) instead
of `inline`.

### Costs

- **1**: at the common 760 px width the column no longer fits beside the
  labels, so every card goes under its labels and the steppers become very
  wide (434 px). Four equal language segments need four times the longest
  name. It looks tidy only at 1000 px.
- **2**: Kieli and Laajuus take one more click to change, and the choice is no
  longer visible at a glance. Laajuus's note still follows the current value
  in the row description.
- **3**: tallest page: Kieli is 187 px and Laajuus 204 px instead of one
  line; on the phone the Ulkoasu card nearly doubles.

## Recommendation

**Direction 2.** It removes the wrap where it comes from: four long names do
not belong in a segment. It also scales to a fifth language without layout
work, and it keeps the label-beside-control rows that the rest of Settings
uses. The menu's per-option notes make Laajuus's levels easier to compare
than the segment did. The compact stepper with the unit outside reads as one
value, and its buttons are the same 32 px as the segments. Direction 1's equal
segments are worth keeping for the 2–3 option rows only if Jari likes them; 3
is the clearest but costs the most height.

Implementation sketch (no production code changed here): `Segmented` in
settings rows at `size="row"` with `flex-wrap: nowrap`, and `.s-row`
collapsing to one column when its control does not fit; a `ChoiceMenu` built
on the existing `Menu`/`MenuTrigger` (`Overlays.tsx`) with radio items and
notes, as a sheet on the phone; `NumberStepper` at `row` size with a centred
value and the unit outside. Teema and Agentin työ get `.s-val` like the
others. No host or contract change.

## Questions for Jari

1. Which direction: 1 (one column), 2 (menu for many) or 3 (list)? I
   recommend 2.
2. In 2, does Katsauksen laajuus (four short levels) go into a menu like
   Kieli, or stay a segment and only long names move to a menu?
3. A number always names its unit, including *5 conversations*: is that
   what you want?
