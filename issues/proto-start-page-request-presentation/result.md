# Result: how a start-page request looks before and after sending

Round `design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/`
(NOTES.md in Finnish). One flow shown as three screens side by side:
**a** where the request starts, **b** what pressing does, **c** how the
sent request reads in the history. There are two rows, one for the workspace
page's *Luo/Päivitä aloitussivu* and one for the empty conversation's button.
The screens sit side by side at 1440 px and stack at 390 px. *Tila* in the
review bar switches between the create and update wording. Built from
production components. The workspace, times and agent reply are synthetic,
and the folded instruction is the installed skill text verbatim.

## What today really is

The lab capture (`nyt.mjs`, `evidence/nyt-{sivu,kentassa,lahetetty,tyhja}-{1440,390}.avif`)
matches the round's *Nyt* view:

- The workspace page's button opens a new conversation with
  `/open-habitat-start-page ` as raw text in the field
  (`WorkspaceLanding.tsx` → `prepareInvocation`).
- **Pi expands only `/skill:<name>`** (`_expandSkillCommand` in the
  installed pi-coding-agent), so this text is not a skill call. The model
  receives it as an ordinary message and has to work out on its own that
  it should read the skill. The history shows a plain bubble
  `/open-habitat-start-page`, and the conversation is named after it
  ("/open-habitat-sta…"). The "native skill name + template" chip only
  appears when the skill is chosen from the command list, a path the button
  does not use.
- The empty conversation only says "Pyydä agenttia luomaan työtilalle
  aloitussivu.", and the person writes the request.

This is a real defect in today's behaviour, whichever direction is chosen.
The implementation should send `/skill:open-habitat-start-page`.

## Axis and directions

Axis: how much of the request is visible, and who sends it.

0. **Nyt**: as above.
1. **Siru**: the workspace page's button puts the chip *Luo aloitussivu* in
   the field, and the person sends, optionally adding a wish. The history
   shows the name with the instruction folded behind it.
2. **Heti, ohje**: both buttons send at once and the agent starts. The
   history shows the name with the instruction folded behind it.
3. **Heti, nimi**: both buttons send at once. The history shows only the
   name, with nothing to open.

The empty conversation's button sends at once in every direction, as decided
on 3.11., so that row differs only in screen c. Screens:
`evidence/proto-<n>-<suunta>-{1440,390}-light.avif`, `-paivita-1440-light`,
`proto-0-nyt-1440-dark`, `proto-2-taitettu-1440-dark`, and the opened
instruction `proto-2-taitettu-ohje-{1440,390}-light`.

**Recommendation: Heti, ohje.** On 3.11. Jari decided that the empty
conversation's button starts at once. Under the same label, the workspace
page's button should behave the same way: two buttons that look the same
should not need two different mental models. The agent only proposes and
writes nothing before approval, so starting at once costs one proposal
turn and risks nothing. Keeping the instruction folded behind the name keeps
the record honest: anyone can open exactly what the agent was told, just as
with a goal's chip. *Heti, nimi* is the cleanest look, but it hides what was
sent. It would also need a second history presentation used only for the
host's own skill. *Siru* is the only direction that lets the person add a
wish before the run, but the same wish fits naturally as a reply to the
proposal.

## Host facts the view assumes

- The host recognises a call of its own skill `open-habitat-start-page` and
  labels it *Luo aloitussivu* / *Päivitä aloitussivu* with a Finnish
  description, in ordinary type instead of the native name and the English
  frontmatter description. The conversation gets the same name.
- Which label to show (create or update) is decided at send time from the
  start page's state. After a reload the history only has the skill name,
  so a later reader either shows one neutral label or the host records the
  wording somewhere. This is open; the prototype assumes the label survives.
- "Sends at once" from the workspace page means: create the conversation,
  send `/skill:open-habitat-start-page` without arguments, and open the
  conversation with the agent working.
- The folded instruction is the English skill text that Pi records. The
  reader's title stays monospace (`GuideArticle`).

## Build and offer

```
node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/build.mjs
tw browser-open design-system/prototypes/dist/aloitussivupyynto/offline.html
```

`check.mjs` (in the round) passes 118 checkpoints with a clean console.

## Questions for Jari

1. In `proto-1-siru-1440-light` and `proto-2-taitettu-1440-light`, screen
   b of the top row: should the workspace page's button put the chip in the
   field (1) or start at once like the empty conversation (2)?
2. In `proto-2-taitettu-1440-light` and `proto-3-nimi-1440-light`, screen c:
   should the sent request be a name you can open (2) or only a name (3)?
3. In `proto-2-taitettu-ohje-390-light`, is it fine that the opened
   instruction is the skill's English text, or should the host show its own
   Finnish summary there instead?
