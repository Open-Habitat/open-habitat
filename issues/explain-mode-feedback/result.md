# Explain mode feedback: prototype round 1

## Saatesanat

Kierros näyttää, miten selitystilassa annetaan palautetta selityksestä.
Valinnat ovat Auttoi, Väärin ja Puuttuu jotain, ja niihin voi lisätä lyhyen
huomion. Suunnat eroavat siinä, missä kohtaa palaute annetaan. A:ssa
valinnat ovat jokaisen kortin alarivillä, ja kortti pysähtyy, kun aloitat.
B:ssä selitystilan palkissa on Palaute-painike, joka kysyy ensin, mistä
äsken nähdystä kortista on kyse. C kysyy vasta Lopeta-painalluksella
kerralla kaikista korteista, jotka näit. Korttien tekstit ovat tuotannosta,
joten palautetta annetaan oikeista selityksistä.

Toinen näkymä (Näkymä › Minne palaute menee) näyttää, minne palaute menee.
Palaute tallentuu ihmisen omalle tilille hänen omalle palvelimelleen. Siellä
hän näkee omat palautteensa, voi poistaa niitä ja lähettää ne kehittäjille
valmiiksi täytettynä GitHub-tekstinä, jonka hän näkee kokonaan ennen
lähettämistä. Mitään ei lähde itsestään, eikä tila kirjaa, mitä osoitat.

Suosittelen A:ta ja omaa tiliä. Palaute annetaan siinä, missä selitys on,
yhdellä painalluksella, kun selitys auttoi. B:ssä pitää valita kortti
uudelleen, koska osoitin ehtii palkille mennessään osua muihin kohtiin. C
on kevein selata, mutta se kysyy muistinvaraisesti ja lisää kysymyksen
lopettamiseen.

## Built page

`design-system/prototypes/dist/explain-feedback/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-explain-feedback/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/explain-mode-feedback/offline.html`; the check's
screenshots are in `/var/tmp/agent-keep/explain-mode-feedback/check/`.
Sources, URL parameters and commands are in the round's `NOTES.md`.

`check.mjs` passed 209 checks with a clean console: each direction at 1440
and 390 px in Päivä and Yö (plus Korkea kontrasti and English once), the
default view different per direction and inside the viewport, no sideways
scroll, each direction's save flow, C's skip saving nothing, every saved
item appearing in the destination panel, and the prefilled text holding
only the card name, id, choice and note. The round directory holds no
image or HTML file.

## Axis and directions

Axis: **where the person gives feedback on an explanation.** Same cards,
same three choices, same note and destination in all three.

- **A Card footer.** Every card ends with "Did this help?" and Helped /
  Wrong / Something missing. Helped saves at once and the footer turns into
  "Thanks. Your feedback is kept in your own account. Where does this go?".
  Wrong and Something missing open a note (optional, 280 characters) with
  Save / Cancel, and the card stays put until one of them; Esc cancels.
  A card with feedback from this session shows "You said: Wrong · Change".
  Decides: the desktop card takes the pointer (production has
  `pointer-events: none`), so a part under the card is reached by moving
  around it.
- **B Feedback in the bar.** The explain bar gets a Feedback button. It
  opens a sheet (a bottom sheet on a phone) that first asks which of the
  last four cards seen, the latest chosen, then the choice and note. The
  button counts this session's feedback. Decides: cards stay exactly as in
  production; the price is the extra "which card" step, because the way
  from a part to the bar crosses other parts.
- **C At the end.** Cards are unchanged. Stop (or Esc) opens one sheet
  "You saw 4 explanations. Did they help?" with the three choices per card,
  one note, "Don't ask this when stopping", Save and stop / Stop without
  answering. Decides: no feedback UI while explaining; the question is on
  the way out and relies on memory.

## Where feedback goes (secondary panel)

The panel compares three destinations and shows the recommended one working:

| Destination | Who sees it | What it takes |
|---|---|---|
| **Own account, the person sends it** (recommended) | Only the person, until they send it. Sent text is public on GitHub. | The per-user daemon keeps the feedback in the person's home; a new contract operation; no new authority. |
| Server administrator | The administrator sees the person's name and notes without anything being sent. | A store shared across Unix users that some component reads across the user boundary: an architecture change. |
| Own agent | The person and the agent's model provider; the agent can file an issue with the person's `gh`. | Nothing new, but feedback mixes with work conversations, and the agent cannot change a product explanation. |

Plus a fixed line: never hidden tracking; the mode records nothing about
what is pointed at or for how long.

The sending step is a prefilled GitHub issue the person sees in full
(title, one line per card: name, card id, choice, note; Open Habitat
version and language). It carries no conversation, workspace name, file or
host detail.

## Host facts the view assumes

- A place in the person's own account where feedback is kept: written and
  read by the per-user daemon, e.g. a small file in the user's state
  directory. This is a new store; its concrete need is this feature, and
  it is the person's own data, not a second copy of a native one.
- A contract operation to add, list and delete one's own feedback
  (`contracts/v1/` first).
- The card id (`X05`, `Y05`…) is stable enough to name in an issue, and
  the product version is known to the browser.
- Nothing about other users; nothing leaves the server unless the person
  opens the prefilled issue.

## Decisions for later review

- **Three choices, not thumbs.** Alternatives: thumbs up/down; a 1–5 scale.
  Why: "wrong" and "missing" are different fixes to a card, and the
  developer needs to know which; a scale says nothing actionable.
- **Note optional, 280 characters.** Alternatives: required note; no note.
  Why: a required note stops most people from answering; no note loses
  what was wrong.
- **Helped saves with one press, without a note.** Alternative: the same
  form for all. Why: positive feedback is only useful if it costs nothing.
- **Destination is the person's own account, and sending is their own act
  through a public GitHub issue.** Alternatives: administrator store,
  own agent, e-mail. Why: no new authority, no hidden flow, and the text
  reaches the developers in the place reports already arrive.
- **The "where" view lives with explain mode for now** (reached from
  "Where does this go?"). Alternative: a Settings section. Why: it is
  needed only by someone who has given feedback; where it finally sits is
  open below.
- **C offers "don't ask again"**, because a question on every exit would
  become noise.

## Questions for Jari

1. A, B or C? (Recommendation: A.)
2. Should the server administrator see everyone's feedback without the
   person sending it? That needs a store read across Unix users, i.e. a
   new authority (gateway or provisioner), and would come to you as an
   architecture recommendation first. The prototype assumes **no**.
3. Is a public GitHub issue the right place for sent feedback, or do you
   want a private route (e-mail to you, a GitHub Discussion category)? A
   person without a GitHub account cannot send with the current design.
4. Where does "Your feedback" live in the end: behind "Where does this go?"
   only, or also as a section in Settings?
