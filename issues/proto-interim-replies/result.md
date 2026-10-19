# Result: interim replies prototype round

Round directory `design-system/prototypes/rounds/2026-10-19-valivastaukset/`. Build and open:

```
cd design-system/prototypes
node build.mjs rounds/2026-10-19-valivastaukset          # → dist/2026-10-19-valivastaukset.html
tw browser-open dist/2026-10-19-valivastaukset.html
```

Picker keys 1–4 switch directions, R replays the live turn, and "Hidastettu" slows it.
Click a turn's `PI` head to open its work. Screenshots are in `screenshots/`: for each
direction, `-kiinni` (default, work closed), `-auki-tumma` (all work open, dark),
`-elava` (live: the interim reply has just been written and `git pull` runs) and
`-puhelin` (390 px, closed).

## The axis

**What an interim reply is in relation to the work and the final answer.** All three
directions show it as a real message that stays visible when the work is closed. They
differ in where it belongs.

The fixture is a Claude Opus 5.5 conversation in fleetrepo:

- a sync turn with two short interim replies, including "Working tree on puhdas …";
- a backup check with one long, structured interim reply, and a short one written right
  before the final answer with nothing between them;
- a live sync of open-habitat where an interim reply streams between `git log` and
  `git pull`.

## Directions

**1 · Viesti langassa.** An interim reply is its own reply card, in the place on the turn's
thread where it was written. Its head says "Välivastaus" with a speech icon in the accent
colour and has its own copy button and time. The final answer keeps "✓ Vastaus valmis" and
the model. Closing the work removes only the thinking and tool rows, so the closed turn reads
as a short exchange: message, message, answer.
*Argument:* this is what Jari said: a reply is a reply, and it sits where Pi said it. Nothing
moves when the work opens or closes. It is also the smallest change to production: the
interim text block gets the reply card and stays outside the fold.
*Cost:* with several interim replies, the cards look almost as heavy as the answer. In the
backup turn, the long interim reply is larger than the final answer, and the two cards at
09:21 sit back to back.

**2 · Osa vastausta.** Everything Pi said to the person in a turn goes into one card at the end
of the turn. A "Työn aikana" section lists the interim replies with their times, in a quieter
ink, above a hairline, and the final answer follows below it. While the turn runs, the card
already exists with the head "Työn aikana" and fills up. The final answer then streams into
the same card, and the head changes to "Vastaus valmis". In the open work, a one-line
reference row ("Kirjoitti sinulle 09:13 · Working tree on …") marks where each reply was
written. Clicking it scrolls to the entry and highlights it.
*Argument:* the turn has one message, so the final answer cannot be lost among interim cards,
and reading one card gives the whole story in order. It has the calmest closed view.
*Cost:* an interim reply is not where it was written; the work shows only a reference.
The card also changes in place during the turn, and copying the answer copies only the
final part.

**3 · Vaiheet.** Each interim reply closes a stage of work. Before each reply there is a quiet
summary row ("1 ajatus · 2 työkalua · git rev-list --count origin/main..HEAD") that opens that
stage's work only. The turn head opens or closes all stages. The replies are the same cards
as in direction 1.
*Argument:* the closed view reads as "did this → said this → did that → said that", so Jari
can open exactly the part of the work that a reply talks about. It fits long turns best.
*Cost:* this direction is the busiest. Every stage adds a row, and closing the work no longer
hides it completely. It also adds a new control, the stage summary, that production does not
have.

**4 · Nykyinen.** Production as of 19.10: the interim text is a plain Markdown line among the
tool rows and disappears when the work is closed. In the live state, nothing of it shows
while the work is hidden.

## Recommendation

**1 · Viesti langassa.** It is the literal fix for what Jari reported: the message looks like
an answer, it is visible when the work is closed, and it does not move. It needs no new
control or concept, and the implementation is the narrowest: `HistoryView`/`AgentTurn` keep
text blocks out of the fold and render them with `AssistantMessage` in an interim variant.
The accent label is enough to keep the final answer distinct in the fixture. If the double
card at 09:21 bothers Jari, direction 2 fixes that at the price of moving interim replies,
and it is the one I would take second.

## What Jari needs to decide

1. Which direction (or "1, but …").
2. Is the label right? "Välivastaus" is the working name; alternatives are no label (only the
   icon and time) or "Pi kirjoitti".
3. Should a long interim reply show in full when the work is closed (as all directions do
   now), or be clamped to a few lines with "Näytä koko viesti"?

## What the view assumes from the host

Nothing new. Pi's session already has the text blocks in order inside assistant messages.
The browser already treats the last text block of the turn as the final answer
(`timelineItems` in `web/src/app/HistoryView.tsx`); every earlier text block is an interim
reply. The time of an interim reply is the timestamp of its assistant entry. Streaming
needs nothing beyond today's live text events.

## Decisions for later review

- **The baseline is a fourth picker item, not a separate page.** The alternative was to show
  production only in screenshots. In the picker, Jari can flip between a direction and today's
  look on the same content.
- **The round draws its own turns.** The library's `lanka` and `playLive` allow only one reply
  per turn. A library change would have touched shared `lib/`, which other workers use at the
  same time, so the round has its own renderer built from the library's classes and pieces.
  It also overrides `playLive` so that Lähetä replays this round's turn. If direction 1 or 3
  is chosen, the interim card moves to `lib/` (`noteCard`, `.iv-msg`, `.node.iv-node`), and
  `lanka`/`playLive` learn the `note` block.
- **An interim reply is always shown in full.** The alternative was to clamp long ones. A
  clamped reply is a hidden reply, which is what the issue complains about, so clamping is
  left to Jari (question 3).
- **The fixture is a fleetrepo/open-habitat git session with Claude Opus 5.5.** This matches
  the situation Jari reported instead of the library's GPT status-script story. The top bar's
  model chip is overridden to match.
- **Stage summaries leave out zero counts** ("1 työkalu", not "0 ajatusta · 1 työkalu"), and
  they name the last command of the stage so the stages can be told apart.
