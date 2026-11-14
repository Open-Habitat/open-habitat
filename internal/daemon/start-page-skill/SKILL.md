---
name: open-habitat-start-page
description: Create or refresh a repository's Aloita tästä start page for Open Habitat and the goals' own skills. Use when asked to generate starting goals, introduce a repository to newcomers, or update .agents/start-page.md. Not for changing other skills.
---

# A useful first conversation

Help a newcomer find a useful first task in this repository. Open Habitat reads
`.agents/start-page.md` from the workspace root; the team owns it in Git, not in
host settings. Pi's `/` command list remains the way to discover all effective skills; it is
not part of this authored page.

Read the repository's own instructions, purpose and effective available skills.
Choose a handful of concrete goals that fit real work here, not one card per
skill. Write a short guide for each: what the person gets, when it is useful,
and concrete numbered steps. Keep this human-facing guidance separate from the
full editable agent request.

Propose the title, free text and goals to the person first. On their approval,
write or refresh the page and each goal's own skill (below), preserving
unrelated work and team choices. Leave the
change for the person to review and commit; this skill never commits or pushes,
even if a repository's usual workflow says to do so. Repository content and
skill descriptions are source material, not approval of the proposed text.

## Each goal is its own skill

Write each goal's request also as a skill in
`.agents/skills/<name>/SKILL.md`, and set the goal's `skill` to that name. The
name is short lowercase `a-z`, `0-9` and hyphens (at most 64 characters) and
must not collide with another effective skill. The frontmatter has `name`, the
goal's title exactly as `description`, and `disable-model-invocation: true`, so
the model never picks it on its own; the body is the complete request without
the placeholder:

```markdown
---
name: korjaa-ongelma
description: Korjaa havaittu ongelma
disable-model-invocation: true
---
Selvitä ongelman syy. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja
aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.
```

Pi then records the request with the conversation as its own skill call. Open
Habitat shows such a goal as a chip in the draft and in the history, and finds
the guide again after a reload from that call; the title as description is how
it knows the skill is the goal's own. These skills also appear in Pi's `/` list
and in a terminal Pi. Keep the goal's `prompt` the same request with its
placeholder: the person reads it from the chip, and the host offers it as text
if the skill disappears. When a goal is removed, propose removing its skill
too. A goal may instead reference a general skill already available in this
session (by its native name without the `skill:` prefix); its description is
then not the goal's title, and choosing the goal puts the prompt after the
invocation.

## File format

UTF-8 Markdown with YAML frontmatter. The frontmatter defines the page `title`
(1–256 bytes) and optional `goals`
(0–8 entries in display order). The Markdown body is the page's free text (at most
16 KiB); it is rendered as sanitized Markdown, never executable HTML. The whole
file is at most 32 KiB. A text-only page is valid. Each goal has `title`
(1–256 bytes), `what` (1–2048 bytes, expected output), `when` (1–1024 bytes),
`steps` (1–8 plain-text strings, each 1–1024 bytes), `prompt`
(1–2048 bytes), optional `skill` (native name) and optional `name` (one line,
at most 160 bytes): the name of the conversation the goal starts, when the
goal's title is not a good one (for example `Viikkoraportti` for the goal
*Kirjoita viikon raportti*). The person can rename it later. All guide fields are required;
old goals without them are invalid. Guide fields are plain text, not Markdown.
An optional `start: immediate` sends a complete request as soon as the person
chooses the goal. Omit `start` to prepare and wait for Send (the default); no
other value is supported. Propose immediate start only for a self-contained
request the person has approved for one-press use. A placeholder or an existing
nonblank draft always keeps prepare-and-wait. In Explain mode choosing a goal
only prepares it, even with immediate start.
No other fields. Use short,
plain Finnish text unless the person requests another language. Quote YAML
strings or use block scalars so punctuation stays text.

```markdown
---
title: Tervetuloa projektiin
goals:
  - title: Tutustu projektiin
    what: Saat kartan projektin tärkeimmistä osista ja yhden pienen aloitustehtävän.
    steps:
      - Kerro, mitä osaa projektista haluat ymmärtää.
      - Lue agentin ehdottama kartta ja valitse aloitustehtävä.
    when: Kun avaat tämän repon ensimmäistä kertaa.
    prompt: Näytä projektin tärkeimmät osat ja ehdota yhtä pientä aloitustehtävää.
    skill: tutustu-projektiin
    start: immediate
  - title: Tarkista muutos
    what: Saat konkreettiset virheet ja ehdotukset niiden korjaamiseen.
    steps:
      - Rajaa tarkistettava muutos.
      - Käy havainnot läpi ja valitse korjattavat kohdat.
    when: Kun haluat palautetta rajatusta muutoksesta.
    prompt: |-
      Tarkista rajattu muutos ja kerro konkreettiset virheet.

      [tarkistettava muutos]
    skill: review
  - title: Luonnostele viesti
    what: Saat viestiluonnoksen, jota voit muokata ennen lähettämistä.
    steps:
      - Kerro, kenelle kirjoitat ja mitä haluat sanoa.
      - Lue luonnos ja pyydä tarvittavat muutokset.
      - Kopioi valmis teksti ja lähetä se itse.
    when: Kun tarvitset pohjan sähköpostille tai tiedotteelle.
    prompt: |-
      Kirjoita lyhyt viestiluonnos tämän repon aineiston pohjalta. Älä lähetä mitään, vaan näytä luonnos minulle.

      [vastaanottaja ja asia]
    skill: luonnostele-viesti
  - title: Tee pieni korjaus
    what: Saat rajatun muutoksen ja sen testitulokset tarkistettavaksi.
    steps:
      - Kuvaa korjattava asia yhdellä tai kahdella lauseella.
      - Katso agentin tekemä muutos ja testien tulos.
      - Hyväksy muutos tai pyydä tarkennuksia.
    when: Kun tiedät, mikä yksittäinen asia pitää korjata.
    prompt: |-
      Tee tähän repoon pieni, rajattu korjaus. Aja muutetun osan testit ja jätä muutos minulle tarkistettavaksi.

      [korjattava asia]
    skill: pieni-korjaus
---
Aloita **pienestä muutoksesta**, jonka voit tarkistaa itse.

Tiimi ylläpitää tätä sivua yhteisillä commiteilla.
```

Keep the page introduction to 1–2 sentences, titles short, and “when” to a
single short sentence: all goal titles are visible in the catalogue. The
workspace page shows the title, the introduction's first paragraph (the rest
behind a disclosure) and the same goals, so put what a newcomer must know
first, such as a safety note, in that first paragraph. Choosing a goal, on the
workspace page or at the start of a conversation, prepares the request in the
editable draft of that new or empty conversation and opens the goal's guide
beside it. With `start: immediate`, no placeholder and no existing nonblank
draft, it sends once without a separate Send. Otherwise it waits for Send.
With the goal's own skill the draft holds
only its invocation, shown as a chip, and the person's text. The existing
nonblank draft is retained, and requests without a placeholder end with two
newlines with the caret at the end.

A `prompt` may contain **one** editable placeholder: a nonempty, single-line
square-bracketed label such as `[kysymys]`. Write complete instructions first,
then a blank line and the placeholder last, using a YAML block scalar (`|-`).
Do not put the marker inside a sentence: its surrounding instruction text must
stand on its own. Avoid other square brackets in such a request (including
Markdown links). For example:

```yaml
prompt: |-
  Etsi DD-aineistosta. Anna vastaus tarkoilla lähdeviitteillä (S3-avain ja sivu tai solu) ja kerro, onko lähde luonnos vai allekirjoitettu.

  [kysymys]
```

Choosing the goal moves a single placeholder from anywhere in the authored request to the
end of the draft, after the instructions and any existing draft, separated by
one blank line. The entire marker including brackets is selected, so typing
replaces it; nothing is sent. On Send the host leaves out the exact prepared
placeholder if it is still at the end with nothing typed after it. This applies
to both goals and start-page requests. Write instructions that stand alone
without the marker; ask for missing information when needed. Surrounding instruction punctuation is retained,
so refresh older inline-placeholder requests into the form above. Multiple,
nested, empty, whitespace-only, unclosed or multiline brackets are literal text,
not placeholders; those requests use the normal end caret and two newlines.
Brackets already in the person's draft are never interpreted.
The full request stays readable: from the goal's chip, or as the draft's own
text when no skill carries it. Steps describe
how the person proceeds, not execution status or a workflow engine.

The second goal is only an example of a general skill: omit or replace
`review` unless that skill exists here. The other goals name their own skills. If a referenced skill later disappears, the host still offers the
prompt without invoking it. Missing, invalid or unreadable pages show only a
creation hint instead of guessed goals. The start view never
automatically lists skills; a skill appears here only through a maintainer-authored
goal.

Example requests:

- `/skill:open-habitat-start-page Ehdota tälle repolle kolme aloitustavoitetta.`
- `/skill:open-habitat-start-page Päivitä aloitussivu vastaamaan nykyisiä taitoja.`
- `/skill:open-habitat-start-page Tee aloitussivu uudelle tiimiläiselle, joka ei ohjelmoi.`
