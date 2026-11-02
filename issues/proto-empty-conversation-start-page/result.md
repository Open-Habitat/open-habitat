# Result: prototype round 1, Luo aloitussivu in the empty conversation

Round `design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/`
(NOTES.md in Finnish). One view: the empty new conversation of a workspace
without a start page, phone 390 and desktop 1440, light and dark. Built from
production components; workspaces, times and the agent's reply are
synthetic. Today's view, captured from the synthetic lab with the round's
`nyt.mjs`, is `evidence/nyt-oletus-{1440,390}-light.avif`. Jari's iPhone
screenshot was not on this host (`/var/tmp/oh-r54/` absent on Birch and
Alder), so the lab capture stands in for it.

## Axis and directions

Axis: where the invitation sits in the empty space, and what pressing it does.

1. **Rivi ja painike**: a quiet dashed line like the workspace page's, with
   a secondary *Luo aloitussivu*. Pressing puts the request into the field
   as the goal chip *Luo aloitussivu*, with the caret after it, and the line
   turns into "Pyyntö on viestikentässä. Lisää halutessasi toiveesi ja
   lähetä." The person sends. This does what the workspace page's button
   already does.
2. **Kortti, alkaa heti**: a card that says what the page will contain
   (an introduction, a few goals, each goal's own instructions) and that
   nothing is written before approval, with a primary *Luo aloitussivu*.
   Pressing sends the request at once, and the agent starts in this
   conversation.
3. **Kentän yllä**: the empty space stays empty. A *+ Luo aloitussivu*
   suggestion with "Esittely ja tavoitteet tälle työtilalle" sits just
   above the field. Pressing replaces the suggestion with the goal chip in
   the field. The person sends.

Screens: `evidence/d<n>-<suunta>-{oletus,kentassa,lahetetty}-{1440,390}-light.avif`,
plus `-oletus-1440-dark`.

**Recommendation: Rivi ja painike.** It matches what pressing the same
button on the workspace page really does: it prepares the field without
sending. A person pressing it in a conversation gets the same result as on
the landing, and can add a wish such as "korosta viikkoyhteenvetoja" before
anything runs. The card explains more but spends a run on a single tap, and
it makes the same label behave differently in two places. The suggestion
above the field is the least visible on a phone, where it competes with the
keyboard and the field's own rows.

## Host facts the view assumes

- The start-page skill is an ordinary Pi skill that the daemon installs as
  `open-habitat-start-page/SKILL.md` (`internal/daemon/start_page_linux.go`).
  The prototype's draft is `/skill:open-habitat-start-page `, which the
  composer already shows as a goal chip when the page's `goals` include a
  goal with that `skill` (`GoalChip.splitGoal`). Implementing this needs the
  host to pass a synthetic goal for its own skill, with the title
  *Luo aloitussivu*. Today the workspace landing inserts the bare text
  `/open-habitat-start-page ` instead (`WorkspaceLanding.tsx`,
  `prepareInvocation`), and it shows in the field as raw text.
- The skill proposes the title, text and goals first and writes nothing
  before approval, so "the agent starts at once" (direction 2) means a
  proposal turn, not a written file. The prototype's reply says this.
- After sending, today's history renders the call with `SkillInvocation`,
  using the native name in monospace and the skill's English description.
  The prototype shows *Luo aloitussivu* · "Esittely ja tavoitteet tälle
  työtilalle" in ordinary type, which is a proposed host change. The goal
  chip's reader card also shows the eyebrow `TAVOITE · /skill:<name>`
  (`text/goalChip.ts`).
- The *Päivitä aloitussivu* (`needs_update`) state was not prototyped. The
  chosen direction would apply to it with the update wording.

## Build and offer

```
node design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/build.mjs
tw browser-open design-system/prototypes/dist/aloitussivun-painike/offline.html
```

`check.mjs` (in the round) passes 40 checkpoints with a clean console.

## Questions for Jari

1. When pressed, should the request go into the field for you to send
   (recommended, same as the workspace page), or should the agent start at
   once?
2. Should the workspace page's *Luo aloitussivu* / *Päivitä aloitussivu*
   also fill the field with the chip instead of the bare command text, so
   neither place shows the command?
3. Should a sent call of the host's own start-page skill show in the history
   as *Luo aloitussivu* rather than its native skill name?
