# Result: how a start-page request looks before and after sending

Two rounds have been run. Round 1 (`design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/`)
compared sending at once with a chip. It also found that the button inserted
a bare command that Pi does not expand, which `ee83ab01` fixed. Jari then
chose a template prompt, and round 2 shows that choice.

## Round 2: the template prompt

Round `design-system/prototypes/rounds/2026-11-03-aloitussivupyynto-2/`
(NOTES.md in Finnish). Both buttons, *Luo/Päivitä aloitussivu* on the
workspace page and the empty conversation's row and button, put the same
template in the message field. The template is a sentence for the agent, a
line break, and a bracketed placeholder that is already selected, so typing
replaces it. Nothing is sent. Each row has three screens: **a** the start,
**b** the field, **c** the sent request in the history. On the workspace
page's row, c shows a typed wish. On the empty conversation's row, c shows
what happens when the person sends without touching the placeholder. The
review bar switches Tila (create or update), Kieli (fi or en) and Teema. The
b fields are live, so typing and sending there redraws c.

Axis: how the skill shows in the field and the history, and what an
untouched placeholder does on send.

1. **Nimi lauseessa**: plain text, "Luodaan aloitussivu käyttäen
   open-habitat-start-page-taitoa." / "[anna lisäohjeita]". An untouched
   placeholder is silently dropped. The history shows the same sentence as
   an ordinary message.
2. **Siru ja lause**: the existing goal chip *Luo aloitussivu* with
   "Luodaan tälle työtilalle aloitussivu." / "[anna lisäohjeita]". A hint
   under the field says an untouched bracketed line is left out. The history
   shows the chip *Luo aloitussivu*, with the instruction folded behind it,
   and then the sentence.
3. **Komento näkyvissä**: the raw text `/skill:open-habitat-start-page Luo
   tälle työtilalle aloitussivu.` / "[lisäohjeet, jos on]". The placeholder
   is sent as it is. The history shows today's native skill chip (monospace
   name, English description) and then the sentence.

Screens are in `evidence/r2-<n>-<suunta>[-paivita|-en|-ohje]-{1440,390}-{light,dark}.avif`.

**Recommendation: Siru ja lause.** Directions 2 and 3 send the same bytes:
`/skill:open-habitat-start-page <sentence>\n<wish>`. Pi expands a skill only
at the start of a message, so this is a real skill call, recorded as one.
Direction 1 only names the skill inside a sentence. The model then has to
decide to load it, and the history records no skill call. I did not try
this with a real model. Of the two reliable forms, the chip keeps
`/skill:` and the native name off the screen (web/AGENTS.md: UI text
without internals). It reuses the goal chip and the placeholder selection
that goals already have, so the start-page request becomes one more
goal-like draft instead of a new mechanism. Dropping an untouched
placeholder keeps the history clean. The hint makes that drop visible
rather than magic.

## Host facts the view assumes

- The button's draft is `/skill:open-habitat-start-page ` + sentence + `\n`
  + placeholder, with the placeholder selected, through the same prepared
  field that goals use (`prepareField`/`usePreparedField`). The composer
  needs `open-habitat-start-page` among its `goals` (title *Luo/Päivitä
  aloitussivu*, request = skill body) to draw the chip. Today
  `composerGoals` lists only authored goals.
- Dropping an untouched placeholder is new. Today a goal's untouched
  `[kysymys]` is sent as it is. The composer has to know which bracketed
  line the host prepared, not treat every bracketed line as one, since
  brackets the person writes are never interpreted. Whether goals get the
  same drop is question 2.
- The sentence is in the person's interface language, chosen when the
  button is pressed. The history label: the sentence already says create or
  update, so the chip in the history could be a neutral *Aloitussivu* that
  needs no stored state. The prototype shows *Luo/Päivitä aloitussivu* as in
  round 1. Showing the host's own title instead of the native name for this
  one skill is a host presentation rule that does not exist yet.
- The empty conversation's button now also only prepares the field. That
  replaces the round 1 decision that it starts at once (Jari 3.11. on round
  1: "both buttons").

## Decisions for later review

- **Placeholder wording** "[anna lisäohjeita]" (dirs 1 and 2), versus
  "[lisäohjeet, jos on]" in dir 3, where it has to make sense to the agent
  when sent unchanged.
- **The sentence differs between dir 1 and dir 2.** Jari's wording "käyttäen
  …-taitoa" is used in dir 1, where it is the only thing that names the
  skill. With the chip, naming the skill again would be redundant, so dir 2
  says "Luodaan tälle työtilalle aloitussivu."
- **English** sentences are in the round's catalog. Dir 1: "Let's create the
  start page using the open-habitat-start-page skill." Dirs 2 and 3: "Create
  a start page for this workspace." Placeholder: "[add instructions]".

## Build and offer

```
node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto-2/build.mjs
tw browser-open design-system/prototypes/dist/aloitussivupyynto-2/offline.html
```

`check.mjs` (in the round) passes 146 checkpoints with a clean console.

## Questions for Jari

1. In `r2-1-nimi-1440-light`, `r2-2-siru-1440-light` and
   `r2-3-komento-1440-light`, screen b: should the field show the skill as
   the chip (2), as a name inside the sentence (1), or as the raw command
   (3)?
2. In `r2-2-siru-1440-light`, bottom row c, where the line was left out:
   should an untouched placeholder be dropped like this, and should goals'
   `[kysymys]` then behave the same way? Or should it be sent as it is, as
   in `r2-3-komento-1440-light`?
3. In `r2-2-siru-1440-light`, the hint under the field b ("Jos et kirjoita
   mitään, hakasulkeinen rivi jää pois."): keep it, or drop the line
   silently as in `r2-1-nimi-1440-light`?
