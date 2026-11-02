---
created: 2026-11-02
updated: 2026-11-02
type: improvement
reporter: jari
status: open
priority: high
lane: ui-text
lane_seq: 1
preparation: ready
---

# UI text explains files, limits and models instead of saying what the person can do

## Description

Jari 2.11. (iPhone, workspace landing of `tailspin-monorepo`): the view is
full of text that explains the implementation to the person:

- under the icon wish field: "Toive enintään 4096 merkkiä. Liitteeksi kuva
  tai UTF-8-tekstiä (yhteensä enintään 64 kt tekstiä). Liitteet ovat
  mallille esimerkkejä, eivät uusia kuvakevaihtoehtoja." and "Malli näkee:
  nimi, README:n alku, kielet (…). openai-codex/gpt-6-luna";
- the start page card: "Tällä työtilalla ei ole aloitussivua. Agentti
  kirjoittaa sen .agents/start-page.md:hen, ja sama esittely näkyy sitten
  täällä ja uuden keskustelun alussa."

Jari: why explain files to the user? In such places there should be
nothing, or an invitation in plain words ("Luo tähän etusivu, jossa on …").

Rule (to `web/AGENTS.md` beside the catalogs): interface text says what the
person can do and what happens for them; it does not name files, paths,
byte or character limits, encodings, model ids or internal mechanisms. A
limit is said only when the person hits it, in the error. Technical detail
that someone may need lives in the agent's UI reference
(`open-habitat-ui`) or the operator guide, not on the screen.

Fix the two views above, then sweep the Finnish and English catalogs for
the same pattern and fix what is clearly of this kind; list borderline
cases in result.md instead of changing them.

## Acceptance Criteria

- [ ] The icon wish field and the start page card carry no implementation text; the start page card invites in plain words.
- [ ] The rule is in `web/AGENTS.md`; the catalog sweep is done, with changes and borderline cases listed in result.md; tests/screenshots updated.


## Addition (Jari 2.11.)

The empty new conversation's "Luo aloitussivu kirjoittamalla viestikenttään
/open-habitat-start-page." is the same kind of text. Jari would rather have
a *Luo aloitussivu* button there, but **prototyped first**
(`proto-empty-conversation-start-page`); this issue does not build it.
