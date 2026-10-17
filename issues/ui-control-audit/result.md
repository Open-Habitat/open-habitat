# Result: control catalogue, plain fixes, button round

**Status:** catalogue and plain fixes done. The issue stays open: Jari still
has to choose the button size system from round `2026-10-17-painikkeet`
(questions at the end). After his choice, the system goes into
`design-system/design.md`, the tokens and `Controls.module.css`.

## Catalogue

[`catalogue.html`](catalogue.html) is a self-contained page (open it
offline): every button and button-like control on 24 lab screens (sign-in,
home, phone drawer, account menu, workspace page and its details, a saved
conversation, a live conversation, its details, the background strip closed
and open, all nine settings sections, administration, and the three onboarding
steps), each in four presentations (light and dark, 1440 px and 390 px). It
groups controls by kind and then by family (same component, same classes) and
shows a crop per presentation, a focused crop, the measured height, padding,
radius, font, surface, icon size and gap, and the focus ring. It also flags
plain defects it can measure: icon gap and centring, and whether the ring is
actually painted on all four sides (read from screen pixels, so overflow,
covering siblings and the viewport all count). The page shows the state after
the fixes below. [`catalogue-before.html`](catalogue-before.html) is the same
capture before them.

Regenerate with the lab running (own `OH_PORT_BASE`):

```
node web/lab/capture-controls.mjs .cache/lab/controls        # ~45 min
node web/lab/build-control-catalogue.mjs .cache/lab/controls issues/ui-control-audit/catalogue.html
```

### Variants and where they differ (before the fixes)

Heights and fonts in px (font = size/weight). "Families" counts distinct
component + class combinations; instances are summed over all screens and
presentations.

| Kind | Families | Height | Font | Radius | Icon | Icon gap | Focus ring |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primary | 1 | 44 | 14.5/600 | 8 | 18 | **0** | 2 px +2 |
| Secondary | 2 | 36 · 44 | 14.5/600 | 8 | – | – | 2 px +2 |
| Quiet text | 4 | 26 · 28 · 44 | 12/600 · 12.5/500 · 14.5/600 | 6 · 8 | – | – | 2 px +1 · +2 |
| Danger | 1 | 36 | 14.5/600 | 8 | – | – | 2 px +2 |
| Icon only | 18 | 26 · 28 · 30 · 32 · 36 · 40 · 44 | – | 6 · 8 · 9 · 50 % | 13 · 15 · 16 · 17 · 18 · 20 | – | 2 px +1 · +2 |
| Back | 1 | 44 | 14.5/600 | 8 | – | – | 2 px +2 |
| Account menu | 1 | 44 | 13.5–14.5/600 | 8 | – | – | 2 px +2 |
| Pills and chips | 6 | 28 · 32 · 33 · 44 | 12.5/500–600 · 14.5 | 8 · pill | 14 | 6 · 12.5 · 14 | **1 px UA** · 2 px −2 · +1 · +2 |
| Segments | 3 | 28 · 30 · 32 | 12–13.5/500 | 6 · 8 | 16 | 6 | 2 px +2 |
| Tabs | 1 | 32 | 12.5/600 | 0 | 14 | 6 | 2 px −2 (keyboard only) |
| Menu items | 2 | 36 | 14.5/400 | 5 | – | – | 2 px +2 |
| Disclosures | 3 | 21 · 28 · 48 | 12.5–13/400 | 0 | – | – | **1 px UA** |
| Navigation rows | 7 | 31 · 32 · 36 · 39 · 41 · 44 | 13–14.5/400–600 | 0 · 8 · 9 | 16 · 18 | 9 | 2 px +2 |
| Text links | 4 | 15–41 | 12.5–14.5 | 0 | – | – | 2 px +2 |

Hover and pressed come from one place for every `ControlButton`, `LinkRow`
and menu item (`interactive.module.css`: variant colour, then the hover and
pressed tokens); pills, segments, settings rows and the strip's tabs draw
their own `:hover` in their CSS file. Disabled is uniform for the primitives
(`--ah-disabled-bg` / `--ah-disabled-fg`), and the bespoke segments use
`opacity: .55` instead.

What the table says: there is one shared button component, but its size is
decided locally. The base is a 44 px touch target with 14.5 px text; 20
rules in `components.css`, `HomeWorkspaces.css` and `ProcessTray.css` (rules
whose selector targets the button primitive or its named variants and that
set height, padding or font) then override it for their context (rail, composer, top bar, tool output,
cards). Icon-only buttons come in seven heights, six icon sizes and four radii.
Pills, segments and tabs are bespoke `<button>`s outside the primitive, each
with its own geometry. These are system choices, not defects; the round below
puts them to Jari.

## Plain defects fixed

Wrong under any reasonable system, so fixed now:

1. **Icon beside text** (Näytä koodi, and every text button with an icon):
   the SVG sat on the text baseline, 4 px above the text's centre, with no
   gap. `Controls.module.css`: a text button with an icon is an inline flex
   row centred on the text, 6 px gap (`--ah-s2`), 16 px icon.
2. **Näytä koodi too large**: it is the card row's action beside a 36 px icon
   but was the 44 px page-level size. Now `size="compact"` (36 px), as in the
   approved Laitteet prototype (34 px). The global size question is in the
   round.
3. **Lone icons sitting high** (rail "Uusi työtila", phone drawer close,
   strip panel close, micro icon buttons): an inline SVG in a button without
   the `icon` presentation rested on the baseline, 2–4 px high. A lone SVG
   is now a block, which the button centres.
4. **Clipped or covered focus rings**:
   - composer editor under the recap card (separate issue
     `composer-focus-ring-clipped`, its `result.md`);
   - "Tarkista keskustelun tila" on the phone ran edge to edge, so `main`
     cut off both sides of the ring. It now keeps the column gutter
     (`.ah-status-check`) and lines up with the editor;
   - settings navigation rows and settings/account-menu segments touch their
     neighbours, which painted over the focused one's ring. The focused one
     is lifted (`z-index: 1`).
5. **Rings off screen or icons off centre on the phone**: the onboarding
   screens' floating account button sat 2 px from the top of the screen, so
   the top of its ring was off screen; it now keeps `--ah-focus-room` above
   it. The drawer's close button is a fixed 44 px square but kept the
   primitive's 14 px side padding, which pushed its 18 px icon 2 px right; the
   padding is now 0.
6. **Browser-default focus ring** on native `<summary>` controls (model chip,
   Valmiit, Arkisto, the model picker's older models): they showed Chromium's
   1 px ring instead of the system's 2 px accent ring. `summary` is now in the
   global focus rule.

After the fixes the catalogue flags one family (11 before): the
full-screen scrim behind the phone drawer, whose ring lies outside the screen
by design; it closes the drawer and is not a tab stop users aim at.

Paired evidence (synthetic lab; screenshot + static HTML): `before-laitteet-*`
and `after-laitteet-*` (desktop/phone × light/dark) here, and the composer pairs
in `issues/composer-focus-ring-clipped/`. Jari's original image is
`nayta-koodi.avif`.

## Prototype round: Painikkeet · koko ja tiheys

`design-system/prototypes/rounds/2026-10-17-painikkeet/`; build with
`node build.mjs rounds/2026-10-17-painikkeet` in `design-system/prototypes/`
(output `dist/2026-10-17-painikkeet.html`). `check.mjs` is clean (desktop
light and dark, phone light and dark, pill click; no console errors).

**Axis:** how big a button is, and what decides it. Six real screens drawn
once with the same words: Asetukset › Laitteet, Asetukset › Tili and Ulkoasu,
the workspace page, the conversation's lower area (recap, strip pills, editor,
Stop, Ohjaa/Työn jälkeen, queue), the OpenAI onboarding card, and a trash
confirmation, plus the states (rest, hover, pressed, keyboard focus,
disabled). All three directions share the hierarchy (primary filled ·
secondary outlined · quiet tinted, per the earlier `buttons-no-surface`
decision · danger red · danger-soft), the icon rule (icon left of the text,
on its centre line, fixed gap), one focus ring (2 px, 2 px away) and the
radius (8 px; pills fully rounded).

1. **Yksi koko**: every text button 44 px with 14.5 px text, as production now,
   but without the local exceptions; icon buttons 36; pills and segments 32.
   Desktop and phone are identical.
2. **Työpöytäkoko**: the prototype library's size, 34 px with 12.5 px text,
   on desktop; icon buttons 30, pills and segments 28. On the phone the same
   buttons grow to 44 (rows 44, inline 36).
3. **Rooli ratkaisee**: three sizes by role. The screen's main action
   (onboarding, confirmation, send) 44; an action in a card or list row 32;
   pills, segments and controls inside the field or strip 26. On the phone
   row actions grow to 40 and inline to 32.

Host data the view assumes: none new; every screen exists in production.

### Questions for Jari

1. Which size rule: **Yksi koko**, **Työpöytäkoko** or **Rooli ratkaisee**?
   (Recommendation: Rooli ratkaisee. The desktop is primary and dense, and
   most buttons live in card rows where 44 px is what made Näytä koodi look
   too big, yet onboarding and confirmations keep a large target. It is also
   closest to what the views already do by local exceptions, so it replaces
   the 20 overrides with three named sizes.)
2. Should the segmented choices (Teema, ajattelutaso, Ohjaa/Työn jälkeen,
   account-menu theme) and the background-strip pills become part of the same
   button primitive (one size scale, one ring), rather than separate CSS per
   view? (Recommendation: yes; the round draws them that way.)
3. Native disclosures ("Valmiit · 0", "Arkisto · 0") still show the browser's
   ▶ marker. Should they get the same chevron as the rail's workspace rows?

### Jari's decision (2026-10-17)

1. **Rooli ratkaisee**: three sizes by role (main action 44, row action 32,
   pills/segments/inline controls 26; phone rows 40, inline 32).
2. Segmented choices and strip pills belong to the same button primitive:
   "Ehdottomasti. Näin pitää olla."
3. Native disclosures (Valmiit, Arkisto) get the rail's chevron instead of
   the browser marker.

## Checks

Fast web checks (format, lint, types, 207 unit and 154 component tests) pass.
Normal browser suite: 231 passed, 2 skipped; failures were the known
`native key add` and, once, `@lazy-resume Stop before Pi runs` under
eight-worker load (3/3 alone). Lab suite: 43 passed; failures only the known
`expired combined cursor` and `combined stream gap`. New
`lab-composer-focus.spec.ts` 2/2, and red with the old composer rule.
The catalogue itself is synthetic-lab evidence: production bundle, invented
homes and fake Pi, Chromium only.

## Decisions for later review

- Icon size beside text is 16 px with a 6 px gap until the system is chosen;
  the round's directions show 15–18 px depending on size.
- Näytä koodi uses the existing `compact` size (36 px) rather than a new size.
- New token `--ah-focus-room` (ring width + offset): the space a scrolling
  container keeps for a child's focus ring.
- The catalogue's ring check uses programmatic focus. React Aria's
  keyboard-only rings (the strip's tabs) are therefore not judged by it; they
  draw a ring under keyboard focus.
- `.ah-mobile-close`'s own background and border in `components.css` lose to
  the button primitive at equal specificity (the module loads later), so the
  drawer's close button is transparent rather than rail-coloured. It looks
  fine, so only its padding was raised in specificity; the button system
  work should drop or fix the dead declarations.
