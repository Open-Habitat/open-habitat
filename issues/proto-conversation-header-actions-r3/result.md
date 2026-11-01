# Result: who explains the header buttons, and where

Prototype: `prototypes/opastus.html`, built from `prototypes/page.src.html`
by `python3 prototypes/build.py` (tokens and fonts inlined). It reuses round
2's page and machinery: the same header, its measured shortening and working
actions. The picker offers Pohja · Kortti kerran tilille · 1 · Oma ?-painike ·
2 · Agentti selittää · 3 · Aloitussivun nauha. One line per riff at the top
of the page says what differs. Each riff's difference shows on the default
view (*Ensimmäinen uusi keskustelu*). Every view has light and dark themes,
desktop (1024, 1320 and 1680 px) and phone. A **Tilanne** selector covers
three situations: the first new conversation (empty, start page shown), the
first conversation that already has work (no start page), and a later new
conversation (shows what stops each riff). An **Aloitussivu** selector
switches the repository's start page on and off. Jari's Finnish guide is
`prototypes/NOTES.md`. The screenshots in `prototypes/kuvat/` are AVIF at
device scale factor 2. `prototypes/shoot.mjs` takes them and checks the
console. It presses every header control and each riff's own explanation in
every riff, theme, device, width, situation and start-page state, and sends
the riff 2 and 3 question: 1472 presses, with a clean console.

## The axis

**Where the explanation lives and who gives it.** The row stays as on main
(round 1 direction 3).

| | Riff | Who explains | Where, when | Stops |
|---|---|---|---|---|
| — | **Pohja · Kortti kerran tilille** (round 2 riff 1) | Habitat, fixed text | card under the header, by itself, when the row has an unexplained button; later from ⋯ | Selvä, Esc, pressing the button |
| 1 | **Oma ?-painike** | Habitat, fixed text | a **?** last on the row; pressing it pins each button's name under it and opens the card below the tags; works in every conversation | ? again, Esc, Selvä; nothing opens by itself |
| 2 | **Agentti selittää** | the conversation's own agent | a suggestion above the field in an empty conversation, and ⋯ › *Kysy agentilta painikkeista* everywhere; it writes `/skill:open-habitat-ohje Mitä yläpalkin painikkeet tekevät?` into the field and the person sends it | the suggestion goes once it is sent or closed (×) |
| 3 | **Aloitussivun nauha** | names: Habitat; explanation: the agent | a product strip above the start page in an empty conversation: the row's icons with names; pointing at one rings the real button; *Selitä nämä mulle* drafts the same question as riff 2; in a conversation with work, ⋯ opens the card | the strip goes once the question is sent or the strip is closed (×) |

## What exists and what would be new

- **The start page appears only in an empty conversation** (as the
  timeline's empty label, `StartPageRead`) and as the workspace page's
  Esittely. The header and all its buttons are already above it, and main
  disables Uusi otsikko (and the prototype also Tilannekatsaus) with a reason
  while the conversation is empty. The first conversation a person opens is
  usually a new empty one, so this is where a first-time explanation meets
  them. A conversation started over SSH or by an agent never shows the
  start page.
- **The start page is the team's file** (`.agents/start-page.md`). The header
  is product UI. A header tutorial written into each repository's start page
  would be copied into every repository and drift from the product. Riff 3's
  strip is therefore drawn by the product above whatever the start page
  holds, and also when the repository has none.
- **A browser control can already hand the agent a request** the way a goal
  does. `goalDraft`/`prepareInvocation` write `/skill:<name> …` into the field
  and the person sends it; Pi records it as a skill call and the composer
  shows the chip. No new route is needed for riffs 2 and 3.
- **The agent knows nothing about the header.** Pi never sees the browser.
  Without product knowledge it would guess. The daemon already writes one
  product skill for its Pi child (`installStartPageSkill`, embedded
  `start-page-skill/SKILL.md`). A second, `open-habitat-ohje`, would be
  installed the same way. Its button texts should come from the same catalog
  as the browser's (`navigation.ts`), or they drift.
- **The recap is not a precedent for asking the agent.** `recap-extension.mjs`
  is a side-model call that never sends a message to the active agent. An
  explanation via that route would be fixed text with extra cost.
- The agent's answer is plain Markdown. It cannot point at buttons, so it
  says what each looks like. It does not know whether the person is on a
  phone or a narrow window, so it covers both forms in words.

## Host facts each riff needs

- **Pohja**: an explained-button id list in `preferences.json` (round 2's
  question 1). No agent involvement.
- **1**: nothing stored. The row has one more icon, so on a 1024 px window
  shortening starts one step sooner. On a phone the ? sits on the title row
  with Editori, Pääte and ⋯. Since the ? is always there, the ⋯ help item
  goes.
- **2**: the shipped `open-habitat-ohje` skill. One flag that the suggestion
  was used or closed: `localStorage` is enough, or a field in preferences if
  it should follow the person. The question is a real message. It costs one
  turn of the conversation's model, waits in the queue if the agent is busy,
  and stays in that conversation's history and context. That is why the
  prototype warns under the field in a conversation that has work.
- **3**: the same skill and one flag that the strip was used or closed. It
  needs **no start page**: the strip shows above main's *Luo aloitussivu*
  hint too. It needs no new read: the strip lists the row's own visible
  actions.

## Recommendation

**Riff 3 · Aloitussivun nauha, replacing the automatic card, with ⋯ ›
*Mitä painikkeet tekevät?* kept for later.**

- It meets the person where they first see the header: an empty new
  conversation. It covers nothing. Pointing at a strip icon rings the real
  button, so name and place are learned together. A card on top of the start
  page (Pohja) hides the content the person came to read.
- The names are product text and free. Only *Selitä nämä mulle* uses the
  agent, and in an empty conversation that question pollutes no work
  context. The answer also starts a real conversation with the agent, which
  is the habit a newcomer should learn. The conversation is named from it,
  as now.
- It adds no icon to a row that Jari kept as icons and that already
  shortens. That is the cost of riff 1's ?.
- Its gap is the conversation that already has work and is opened first.
  The ⋯ card covers that case, and round 2's tooltip meaning line would help
  there if Jari wants it.

Riff 2's agent answer is the same mechanism. Offered inside a working
conversation, though, it puts help text into that task's context and costs a
turn there, so I would not offer it outside empty conversations.

## Questions for Jari

1. Should the strip **replace** the automatic card entirely, leaving the
   first opened working conversation to the ⋯ card, or should the card stay
   for that case? I recommend replace.
2. Should *Selitä nämä mulle* **draft** the question as goals do (Jari
   29.10.: draft prepared, person sends), or send it at once? I recommend
   draft, for one rule across the start page.
3. Should the shipped `open-habitat-ohje` skill cover **only the header**, or
   Habitat more widely (rail, settings, start page, terminal), so that "ask
   the agent" works for any UI question? I recommend wider, generated from
   the browser's text catalogs.

No production code was changed.
