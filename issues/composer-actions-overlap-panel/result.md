# Composer action row in a narrow column: implemented

Implemented in `8575bf64f`. The composer's bottom row now measures its own
width instead of the viewport. When Liitä, Komennot, Tiedosto, the model pill
and Sanele do not fit beside Send, the row shows the aids as square icons, the
way the phone row already did: no labels, Sanele's slot one icon wide, Valmis
a ✓, and the work chip in its short form without the swap mark. The buttons
keep their accessible names and hover/focus tooltips (Liitä got the quick
tooltip the other aids already had). The model pill keeps its place and
clips its name only when even the icon row is too narrow.

The cause was that the labels were hidden only by a `max-width: 440px`
viewport rule. A file open in the side panel narrows the conversation column
without changing the viewport, so the aids overflowed their part of the row,
the model pill was squeezed to zero width and its text drew over Tiedosto
and Sanele.

## How to try

Open a conversation, open a file in the side panel (Editori) and look at the
composer. Drag the splitter to make the conversation narrower and wider:
the labels go and come back as the row runs out of or regains room. Start
a turn so Ohjaa and Stop appear and check again.

## Verification

- New `web/tests/lab-composer-narrow-row.spec.ts`: a file open beside the
  conversation at 1280 and 1440 px, again at the narrowest column the
  splitter allows, and a 390 px phone, at rest and while Pi works. It
  asserts that no two row controls (Liitä, Komennot, Tiedosto, model pill,
  Sanele, Ohjaa, Stop, Send) intersect, that each stays inside the row and
  keeps a usable width, that no button's content spills out of it, and that
  axe finds no violations in the row. Without the fix it fails at both
  laptop widths (the model pill squeezed out of sight); with it, 3/3, and
  9/9 with `--repeat-each 3` and 250 ms reply jitter.
- Affected specs passed (83 cases across the ordinary and lab configurations): `lab-composer-area`,
  `composer-geometry`, `composer-english`, `dictation-bar`, `speech-input`,
  `lab-dictation-hour`, `attachments`, `attachment-documents`,
  `lab-attachment-refusal`, `lab-attachment-upload-progress`,
  `lab-explain-coverage` and the `lab-composer-*` specs.
- `--tag @a11y`: 91 passed.
- `scripts/test-web-fast.sh`: 266 files / 2,264 tests passed.

Captures of the row before and after (synthetic lab only) are outside the
repository in `/var/tmp/agent-keep/composer-overlap/`.

### Review

Focused self-review, proportionate to a client-only layout change: no
contract, daemon or authority change. Checked the cases where the row's
content changes without a resize (work starting, dictation, language, font
load), the CSS specificity against the phone rules, and that a check cannot
latch or oscillate.

No full browser suite or clean gate was run.

## Decisions for later review

- **Measured, not a container query.** The row decides by whether its own
  content overflows (`web/src/components/composer/rowFit.ts`), because the
  width the labels need depends on the language, the model's name and
  whether Pi is working. A fixed container-query breakpoint would be wrong
  for one of those. The cost is a layout check on each composer render.
- **All aids collapse together**, not one at a time. A row with some labels
  and some icons was judged harder to read.
- **At a boundary width, starting a turn can collapse the labels.** The
  Palkki design says nothing that exists at rest moves when work starts; in
  a column just wide enough for the labelled row at rest, Ohjaa and Stop
  now turn the aids into icons, so Sanele and Send move slightly. Reserving
  room for the work controls at rest would show icons earlier than needed.
- **Icon sizes stay what the row already used** (28 px desktop, 36 px
  phone) and the row's 2 px gap is unchanged, although the design system's
  small-button rules say `inline` is 26/32 px with at least
  `--ah-control-gap` between controls. Aligning the whole row with those
  tokens is a separate change.
