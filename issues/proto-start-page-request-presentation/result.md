# Result: how a start-page request looks before and after sending

Three rounds have been run. Round 1 (`design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/`)
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

Jari chose **Siru ja lause** on 6.11. without the hint (item.md); round 3
answers question 2.

## Round 3: the untouched placeholder on Send

Round `design-system/prototypes/rounds/2026-11-06-aloitussivupyynto-3/`
(NOTES.md in Finnish). Each riff shows two rows with the same steps: the
start page from the workspace page, and the goal *Kysy muistiinpanoista*,
whose prompt ends in `[kysymys]`. **a** is where the request starts, **b**
is the field with the chip and the placeholder selected, and **c** is the
history after sending untouched. Under c, a dashed review aid, *Agentille
lähti*, shows the exact text Pi received, with a dropped line struck
through. The aid is not a product proposal. The b fields are live, so typing
and sending redraws c. The bar switches Kieli and Teema, and has a reset.

Axis: whether an untouched placeholder is cut on Send, and whether the start
page and goals share the rule.

1. **Aina pois**: both are cut. Pi gets
   `/skill:open-habitat-start-page Luodaan tälle työtilalle aloitussivu.` and
   `/skill:kysy-muistiinpanoista`. The goal's history entry is the chip alone.
2. **Aina mukaan**: both go as they are, the goal rule today. The history
   shows `[anna lisäohjeita]` and `[kysymys]` as the person's text.
3. **Eri sääntö**: the start page's optional line is cut, and the goal's
   `[kysymys]` goes as it is, so the agent sees what was left unsaid.

Screens are in `evidence/r3-<n>-<riffi>[-en]-{1440,390}-{light,dark}.avif`.

**Recommendation: Aina pois.** One rule for every prepared placeholder,
so a person who learns it once can rely on it. The goal's own skill already carries the whole
request, so the agent gets a complete instruction either way and asks for
the missing question itself. A literal `[kysymys]` adds no information. It
only leaves a template marker in the history as if the person had written
it. Eri sääntö gives two rules that the field itself does not tell apart,
because both placeholders look the same when selected. Aina mukaan costs
nothing to build, but it keeps the bracket in the history, which is the
thing round 2 set out to remove.

### Host facts round 3 assumes

- Pi expands `/skill:<name>` with nothing after it into the skill block alone
  (`AgentSession._expandSkillCommand` in the installed pi-coding-agent), so a
  goal sent with its placeholder cut is still the goal's skill call.
  Production `HistoryView` then draws the chip with empty text, as the
  prototype does.
- The cut rule is: the draft still ends with the exact placeholder the host
  prepared, and nothing has been typed after it. It is derived from the draft
  and the start page, so it needs no stored state and survives a reload:
  `ComposerGoal` would carry the goal's placeholder (from `goalRequest`), and
  the start-page draft's placeholder is the host's own catalog text. A goal
  without its own skill has no chip to identify it after a reload; until
  then, the tab's prepared field knows its placeholder. A person who types
  exactly the placeholder text is indistinguishable from untouched. That is
  accepted.
- The start-page skill's authoring rules (`internal/daemon/start-page-skill/SKILL.md`,
  the placeholder paragraph) would say that an untouched placeholder is left
  out on Send, so that authors write the instruction text to stand on its
  own. It already asks for that.
- The agent replies are synthetic. Not tried with a real model.

## Build and offer

```
node design-system/prototypes/rounds/2026-11-06-aloitussivupyynto-3/build.mjs
tw browser-open design-system/prototypes/dist/aloitussivupyynto-3/offline.html
```

`check.mjs` (in the round) passes 114 checkpoints with a clean console.

## Questions for Jari

1. In `r3-1-aina-pois-1440-light`, `r3-2-aina-mukaan-1440-light` and
   `r3-3-eri-saanto-1440-light`, the c screens of both rows: which rule should
   apply when the request is sent with the placeholder untouched?
2. In `r3-1-aina-pois-1440-light`, bottom row c: is the chip with no text
   under it enough as the history entry of a goal sent without a question?
