# Result: conversation header buttons a person understands

Prototype: `prototypes/ylapalkki.html`, one hand-written offline page
built from `prototypes/page.src.html` by `python3 prototypes/build.py`
(tokens and fonts inlined), in the same form as
`issues/proto-view-offer-card/prototypes/`. The picker offers Nykyinen ·
1 · Sana painikkeessa · 2 · Paneelit näkyvissä, muut valikossa · 3 ·
Kuvakkeet ja ensiopastus. Every view has light and dark themes, desktop
(1024, 1320 and 1680 px windows, sidebar open) and phone, and a long or
short title. The header sits in a realistic Finnish conversation and every
action works. The editor opens beside the conversation, the terminal opens
below it, the recap appears at the top, the new title replaces the old one
with the dots, and details open as a popover. The desktop row
shortens by measurement, as `useHeaderShortening` does. A table under the
app states each action's meaning and where each direction puts it.
Jari's guide in Finnish is `prototypes/NOTES.md`. Screenshots (device scale
factor 2, AVIF) are in `prototypes/kuvat/`. `prototypes/shoot.mjs` takes
them and presses every action, from the row or from the menu, in every
direction, theme, device, width and title length, with a clean console.

## Baseline: main now

Read from `web/src/components/Navigation.tsx` (`AgentHeader`),
`HeaderShortening.tsx`, `components.css`, `TerminalPanel.tsx`
(`TerminalToggle`), `app/WorkspaceEditor.tsx` (`EditorHeaderControls`),
`ArchiveControls.tsx` and their text catalogs.

- Desktop: after the model chip and a separator, the row has *Editori*,
  *Pääte*, *Tee tilannekatsaus nyt*, *Luo uusi otsikko*, *Arkistoi* and
  *Tiedot* as bare quiet icons. Their names are only in `title` and the
  accessible name. (The issue's "queue" is the recap icon and its
  "recap" is the H↻ new-title icon: the screenshot shows
  editor, terminal, recap, new title, archive and details.) *Opas* and the
  file count appear only when the conversation has a guide or files.
  *Opas* already has an icon and a word.
- When the title would get less than 40 %, step 1 moves the workspace into
  ⋯, and step 3 moves recap, new title, archive and details into ⋯, where
  they have their names.
- Phone: the first row has the title, *Editori*, *Pääte* and ⋯, with no
  tooltip on touch. The ⋯ menu lists the workspace, *Nimeä uudelleen*,
  *Luo uusi otsikko*, *Tee tilannekatsaus nyt*, *Arkistoi* and *Tiedot*
  with names but no explanation.

So a first-time phone user meets two unnamed icons. A first-time desktop
user meets six unnamed icons, and the quick tooltip from `icon-tooltips-slow`
names them only for someone who already hovers over them.

## The axis

**Where a first-time user reads what a button does, without hovering.** I
did not use "different icons" as a direction: a better terminal icon does
not tell someone who has never used a terminal what it is for. What helps
is the name and, for the unfamiliar actions, one line of meaning.

| | Direction | Desktop row | Phone first row | Where the meaning is | Decides | Cost |
|---|---|---|---|---|---|---|
| — | **Nykyinen** | six icons | title, two icons, ⋯ | tooltip (desktop) | icons are learned by hovering | phone users never learn the two icons; desktop users learn them only by hovering |
| 1 | **Sana painikkeessa** | six icon+word buttons | title, two icons with a caption under them, ⋯ | the word | every action names itself where it is | the words need about 1200 px of conversation column. At 1320 px with the sidebar open, recap, new title, archive and details go into ⋯ even with a short title, so on an ordinary screen the row is direction 2 without the explanations. The caption row on a phone takes about 80 px of the title. The header gets heavier, which Jari did not like on 28.10. |
| 2 | **Paneelit näkyvissä, muut valikossa** | *Editori*, *Pääte* with words, ⋯ | title, ⋯ | the word for the panels; name **and one line of meaning** in the menu for the rest | the row holds only toggles (pressed while their panel is open), and one-off actions live in a menu that explains them | recap, new title, archive and details are one press further away; this reverses Jari's 29.10 decision that recap is always in the header; on a phone the editor and terminal are one press further away |
| 3 | **Kuvakkeet ja ensiopastus** | six icons, ⋯ always | title, two icons, ⋯ | a one-time card under the header naming and explaining each visible button; ⋯ › *Mitä painikkeet tekevät?* reopens it | the row stays light and is taught once | people close such cards unread. After that the icons are as opaque as now, and the card is one more thing that appears on its own |

### Each action's meaning (the texts the prototype uses)

| Action | What it does |
|---|---|
| Editori | Opens the workspace's files for editing beside the conversation. |
| Pääte | Opens a command line in the workspace's folder below the conversation. |
| Tilannekatsaus | The agent says briefly what has been done in the conversation and where the work is now. |
| Uusi otsikko | The agent renames the conversation according to what has been discussed. |
| Nimeä uudelleen | Type a name for the conversation yourself. |
| Arkistoi | Moves a finished conversation out of the sidebar; it can be restored. |
| Tiedot | Shows the conversation's folder, model, start time and identifier. |
| ⋯ | Opens the rest of the actions, with their names. |

## Host facts each needs

None. Every direction is presentation in `AgentHeader`, `components.css`,
`HeaderShortening.tsx` and the text catalogs (`navigation.ts`, the menu
descriptions). The `Menu` component's items already take a `description`
(the workspace row uses it), so direction 2's explanation lines need no
new component. Direction 3 needs one remembered flag "header explained",
which can live in browser storage like the recap's dismissal. It is not
host state, and losing it only shows the card again.

## Recommendation

**Direction 2 · Paneelit näkyvissä, muut valikossa.**

- It gives Kaisa words where she looks first. The two buttons left on
  the row are named, and the menu says in a sentence what each one-off
  action does. That sentence is what "Pääte" or "Tilannekatsaus" needs for
  someone who has not met the concept. A word alone (direction 1) names it
  but does not explain it.
- It keeps the header as light as Jari asked on 28.10, and lighter than
  main. Direction 1 is only itself on a 1680 px window. On a 1320 px laptop
  it already falls back to direction 2 without the explanations.
- Desktop and phone get the same menu and the same rule, so learning one
  teaches the other. On a phone the first row gets the whole width for the
  title.
- The row keeps only toggles, so a pressed button always means "this panel
  is open". On main, toggles and one-off commands look the same.

Direction 3 is the cheapest change, but it teaches once and then leaves the
row as opaque as now.

## Questions for Jari

1. Recap was put "always in the header" on 29.10. Direction 2 moves it into
   ⋯ with its explanation. Should it stay in the row as a word button
   *Katsaus* beside *Editori* and *Pääte*? It fits at 1320 px, but then the
   row mixes a one-off command with the panel toggles.
2. On a phone, direction 2 puts *Editori* and *Pääte* in the menu too.
   Would you rather keep them as icons with a caption under them, as in
   direction 1's phone?
3. The explanation lines make the menu tall, especially on a phone (eight
   rows). Should they show only until the person has used each action
   once, or always?

No production code was changed.
