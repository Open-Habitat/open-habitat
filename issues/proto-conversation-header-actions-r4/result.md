# Result: what Selitä nämä mulle opens

Prototype: `prototypes/selitys.html`, built from `prototypes/page.src.html`
by `python3 prototypes/build.py` (tokens and fonts inlined). It reuses round
3's page: the same header, measured shortening, working actions, start page
and strip. Picker: Pohja · Nauha kysyy agentilta · 1 · Nimilaput ja kortti ·
2 · Ryhmät ja koko palkki · 3 · Painike kerrallaan. One line per riff at the
top of the page says what differs. The page opens with *Selitä nämä mulle*
already pressed, so each riff's guide is the default view. **Selitys: Ei
vielä avattu** shows the strip before pressing. Every view has light and
dark themes, desktop (1024, 1320 and 1680 px) and phone, and round 3's
situations and start-page switch. Jari's Finnish guide is
`prototypes/NOTES.md`. The screenshots in `prototypes/kuvat/` are AVIF at
device scale factor 2. `prototypes/shoot.mjs` takes them and runs the check.
The check presses every header control, opens each riff's guide from the
strip or ⋯, walks it to the end and tries Ctrl+Alt+T in every riff, theme,
device, width, situation and start-page state: 2774 presses, clean console.

## The axis

**The guide's shape.** In all four the strip stays as in round 3's riff 3.
Only what *Selitä nämä mulle* opens changes, and from riff 1 on it is
Habitat's own text, not the agent.

| | Riff | Opens | Teaches | Closes |
|---|---|---|---|---|
| — | **Pohja · Nauha kysyy agentilta** (round 3 riff 3) | drafts the question with `open-habitat-ohje`; the agent answers | what the agent can say in text | sending, or × on the strip |
| 1 | **Nimilaput ja kortti** | a name tag under every visible row button, and one card listing them | each visible button's name, meaning and shortcut; the two empty-conversation buttons are marked grey | Selvä closes guide and strip; Esc, × or the strip's button hide the guide only |
| 2 | **Ryhmät ja koko palkki** | tags on the whole header, coloured by kind, and a grouped card | riff 1 plus the kind (panel / one-off / info), the left side (workspace, status, Git, context, model), and which actions are in ⋯ now | as riff 1 |
| 3 | **Painike kerrallaan** | an 8-step tour: one ringed button, its tag and a small card with Edellinen / Seuraava | the same facts as riff 2, one at a time at the button; a button now in ⋯ is shown at ⋯ with its menu name; step 8 covers the left side | Valmis on the last step closes guide and strip; Esc or × stop early |

While the guide is open the strip folds to one line with *Piilota selitys*,
because the tags repeat its icons and the card would cover its right end.
In a conversation that already has work there is no strip, and ⋯ › *Mitä
painikkeet tekevät?* opens the same guide.

## What the guide teaches

This is Habitat's first such lesson. The header facts it covers (the
page's last table carries them, with the narrow and phone placement):

- **Each button's name and meaning**: Editori, Pääte, Tilannekatsaus, Uusi
  otsikko, Arkistoi, Tiedot, ⋯ (Lisää), and Nimeä uudelleen, which lives in
  ⋯ and on the title itself.
- **Panel or one-off**: Editori and Pääte are panels. They open beside or
  under the conversation and stay open, and the same button closes them.
  Tilannekatsaus, Uusi otsikko, Arkistoi and Nimeä uudelleen do one thing
  at once. Tiedot and the left-side chips show state, and pressing one
  opens more.
- **Keyboard shortcuts**: Editori Ctrl+Alt+K (⌘⌥K), Pääte Ctrl+Alt+T or
  Ctrl+Shift+Enter (⌃⌥T). No other header action has one.
- **Why a button is grey**: Tilannekatsaus and Uusi otsikko wait until the
  conversation has something in it.
- **Where things go when space runs out**: the workspace name goes first,
  then the context value, and then the one-offs move into ⋯ under their menu
  names. Last the Git count and the model chip go. On a phone the one-offs
  are always in ⋯ and the chips sit on a second row.
- **The left side** (riffs 2, 3): workspace name, status dot, Git, context
  ring and model.
- **How to get it back**: ⋯ › *Mitä painikkeet tekevät?*.

## Other places that could get a lesson later

For Jari to choose from:

- **Composer**: attachments, dictation, the goal chip, the queue while the
  agent works, Stop.
- **Rail**: what the balls and marks mean, Sinun vuorosi / Käynnissä /
  Viimeisimmät, the workspace `…` menu, archived items.
- **Terminal**: what it is attached to, how it relates to the agent's
  commands, its shortcut and closing.
- **Editor**: the split, Ctrl+Alt+K to return, the file tree, saving and
  conflicts.
- **Settings**: what each section governs (account, keys, integrations,
  experiments).
- **Background strip**: spinoffs and processes above the field.

## Host facts

- **No agent, no skill** for riffs 1–3. The `open-habitat-ohje` skill is now
  `agent-knows-habitat-ui`'s work, not this guide's.
- **One stored flag**: the strip was used (Selvä/Valmis) or closed (×).
  `localStorage` is enough; a field in `preferences.json` if it should
  follow the person across devices. No tour position is stored. The tour
  always starts from the beginning.
- **The texts come from the browser's catalog** (`navigation.ts` and the
  panels' catalogs), so they cannot drift from the buttons. Two things are
  new data there: each action's **kind**, and the **shortcut** as a
  structured value. Today the shortcut exists only inside tooltip strings
  (`workspaceEditor.ts`, `terminalPanel.tsx`), separately from the
  handlers (`isEditorKey`, `isTerminalShortcut`). The guide, the tooltip
  and `agent-knows-habitat-ui`'s generated reference should all read one
  definition.
- **Placement is measured**: tags and the tour card ask the rendered header
  where each control is and whether it is in ⋯, as `HeaderShortening.tsx`
  already measures.
- **Naming**: "Opas" is already the start-page goal's guide panel
  (`text/guide.ts`). This lesson should not be called Opas. The prototype
  says *selitys*.

## Recommendation

**Riff 3 · Painike kerrallaan.**

- It is the only shape that stays honest when the row shortens. Riff 1's
  card lists only what is visible, so on a 1024 px window or a phone the
  one-offs drop out of the lesson. Riff 3 points at ⋯ and gives the menu
  name.
- One button at a time at its real place teaches name, place and behaviour
  together. The small card fits a phone. Riff 2's grouped card has to
  scroll there.
- The panel/one-off distinction and the shortcut fit in a badge and a key
  cap. In riff 2 the same facts need a legend and colour-coded tags, and
  eleven tags crowd the header.
- Its cost is eight presses for someone who wants the overview. × stops at
  any step, and Jari may prefer riff 1's all-at-once view for exactly that
  reason.

## Questions for Jari

1. **Tour (riff 3) or everything at once (riff 1)?** I recommend the tour.
2. Should the lesson cover **the left side too** (workspace, status, Git,
   context, model), or only the buttons? I recommend including it as the
   tour's last step. Those chips are the least self-explanatory part.
3. **Which place gets the next lesson** from the list above? I recommend
   the composer: it is where a newcomer acts first.

No production code was changed.
