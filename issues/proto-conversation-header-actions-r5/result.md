# Result: Selitä nämä mulle opens an explain mode

Prototype: `prototypes/selitystila.html`, built from `prototypes/page.src.html`
by `python3 prototypes/build.py` (tokens and fonts inlined). It reuses round
4's page: the same header, measured shortening, working actions, start page
and strip. Round 4's flat and grouped guides are dropped. Picker:
Pohja · Painike kerrallaan · 1 · Himmennys ja kortti osoittimessa ·
2 · Ääriviivat, painikkeet toimivat · 3 · Vain yläpalkki, lajit väreinä.
One line per riff at the top of the page says what differs. The page opens
with *Selitä nämä mulle* already pressed and Pääte explained, so each riff
shows on the default view. Every view has light and dark themes, desktop
(1024, 1320 and 1680 px) and phone, and round 3's situations and start-page
switch. Jari's Finnish guide is `prototypes/NOTES.md`. The screenshots in
`prototypes/kuvat/` are AVIF at device scale factor 2.
`prototypes/shoot.mjs` takes them and runs the check. The check explains
every visible part in every riff, theme, device, width, situation and
start-page state: by hover on desktop, by tap on a phone. It asserts that the
explanation stays inside the app. It also tries Kokeile, riff 2's live
buttons, Esc and *Näytä kaikki nimet*, and presses every header control:
2893 explanations, 2765 presses, clean console.

## The riffs

The strip stays as in round 3's riff 3. While the mode is on it folds to
one line whose button reads *Lopeta selitys*. Esc and the mode bar's *Lopeta*
also end the mode. In a conversation with work, ⋯ › *Selitä tämä näkymä*
starts the same mode.

| | Riff | Look | Explanation | Scope | Presses during the mode | Phone |
|---|---|---|---|---|---|---|
| — | **Pohja · Painike kerrallaan** (round 4 riff 3) | ring and tag on one button | card under it, Edellinen / Seuraava | header, 8 steps | act | same tour |
| 1 | **Himmennys ja kortti osoittimessa** | dark mode bar on top, whole screen dimmed, the part under the pointer lit | card beside the part, at the pointer's x | whole screen: header, rail, start page, strip, composer, messages, panels | pin the card. **Kokeile** ends the mode and does it | tap pins the card. *Irrota* frees it |
| 2 | **Ääriviivat, painikkeet toimivat** | dashed outline on every part, solid on the explained one, no dimming | docked bar at the bottom, nothing covered | whole screen, plus panels, ⋯ rows and Tiedot opened during the mode | act. The mode stays | first tap explains, second tap presses |
| 3 | **Vain yläpalkki, lajit väreinä** | header lit, rest dimmed. Each header part bordered in its kind's colour, legend in the bar | card under the whole header. *Näytä kaikki nimet* tags every part at once | header only | pin the card. Kokeile | tap. Legend dropped from the bar, kind stays in the card |

## Relation to round 4's facts

Every card carries round 4's facts: the kind badge (Paneeli / Kertatoiminto /
Tietoa / Valikko), the shortcut as a key cap, why a button is grey, and the
menu name when the button now lives in ⋯. ⋯'s own card lists what the menu
holds right now. That keeps riffs 1 and 3 honest on a 1024 px window and on
a phone, where clicks are pinned and the menu cannot be opened in the mode.
The rest of the screen adds three kinds: Siirtyminen (Etusivu, Avaa
työtila), Luettelo (rail sections, workspace groups and rows) and Kirjoitus
(the field). Riff 3 shows round 4's panel / one-off distinction before any
hover, as border colours. Riff 1 shows it only in the card.

## Host facts

- **No agent, no skill.** Texts come from the browser catalogs that the
  `open-habitat-ui` reference is generated from (`navigation.ts`,
  `composer.tsx`, `attachmentMenu.ts`, `dictation.tsx`, `completion.ts`,
  the header's catalogs). The page's last table lists the non-header texts.
- **Every explainable part needs a catalog entry**: name, kind, one
  meaning line and the shortcut as a structured value. Round 4 found that
  the shortcut lives only inside tooltip strings today. The mode makes the
  same need screen-wide: the composer's dictation key (`dictationShortcut.ts`)
  and Enter as well as the header's two. Round 4 asked the guide, the tooltip
  and the generated reference to read one definition. That still holds, for
  more parts.
- **Marking parts**: the prototype marks each part with an attribute and
  measures it as rendered, cut to its scrolling container, so a part
  scrolled out of the stream is not outlined. Production would do the same
  with the components' own roots. No coordinates are stored.
- **A disabled button must still explain itself.** A `disabled` button never
  receives the click, so on a phone the grey Lähetä could not be tapped into
  an explanation. In production the mode needs a layer that catches the press
  and looks through it to the part (riffs 1 and 3 already swallow every press),
  or `aria-disabled` buttons. Riff 2's live presses make this harder: its
  first tap has to reach disabled controls too.
- **Stored state**: the same one flag as round 4 (strip used or closed).
  The mode itself is not remembered.
- **Naming**: "Opas" is already the start-page goal's guide panel. The
  prototype calls this *Selitystila*.

## Recommendation

**Riff 1 · Himmennys ja kortti osoittimessa.**

- It answers Jari's idea most directly: any part of the screen, at the
  pointer, ended by Esc, Lopeta or the strip's button. The dimming makes it
  unmistakable that the screen is in a mode, so a press that does nothing
  is not a surprise.
- Pressing pins the card instead of acting. Reading never causes an
  archive or a recap by accident, and Kokeile still connects explanation to
  action.
- The whole-screen scope costs nothing extra: the texts already exist in
  the catalogs, and a newcomer's questions are as much about the rail balls
  and the composer as about the header.
- Riff 2 is the strongest alternative: you can learn while working, and it
  covers panels opened in the mode. But its outlines make the screen busy,
  its two-tap phone rule is a new gesture, and it needs disabled controls to
  explain themselves while every other press acts. Riff 3's kind colours
  are a good addition to riff 1's card rather than a mode of their own.

## Questions for Jari

1. **Riff 1 (dimmed, presses pin) or riff 2 (outlines, buttons keep
   working)?** I recommend riff 1.
2. **Whole screen or header only?** I recommend the whole screen. That
   makes round 4's list of places for a later lesson (rail, composer,
   terminal, editor) part of this one mode instead of separate lessons.
3. Should the mode get **its own shortcut**, such as `?` outside a text
   field, beside ⋯ › *Selitä tämä näkymä*? I recommend not yet: the strip
   and ⋯ are enough until people ask for it.

No production code was changed.
