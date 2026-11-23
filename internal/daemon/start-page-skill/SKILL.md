---
name: open-habitat-start-page
description: Create or refresh a repository's Aloita tästä start page for Open Habitat and the goals' own skills. Use when asked to generate starting goals, introduce a repository to newcomers, or update .agents/start-page.md. Not for changing other skills.
---

# A useful first conversation

Someone who opens this repository in Open Habitat for the first time often does
not know what to ask an agent for here. The start page (*Aloita tästä*) answers
that with a short introduction and a few goals, each a ready request the person
can pick, adjust and send. Open Habitat reads it from `.agents/start-page.md`
at the workspace root, so it is the team's shared file in Git and everyone sees
the same page.

A good page offers a handful of goals that match real work in this repository,
worded for someone who has not worked here and may not program. It is not a
catalogue of skills: Pi's `/` list already shows every skill, and a skill
reaches the page only through a goal built on it. Start from the repository's
instructions, purpose and available skills, and ask what a newcomer would
usefully do first.

The page speaks to every newcomer in the team's name, so the person decides
what it says. Show them the proposed title, introduction and goals before
writing files; what the repository or a skill description says is material for
the proposal, not their approval of it. When refreshing, the existing page and
goal skills hold choices the team has already made: change what the request is
about and keep the rest. Leave the result uncommitted. Committing is what
publishes the page to the team, and that step stays with the person even where
the repository's own instructions have agents commit and push their work.

Write in short, plain Finnish unless the person asks for another language.

## What the person sees

The workspace page shows the page title, the first paragraph of the
introduction (the rest behind a disclosure) and the goals; the start of a new
conversation lists the same goals. All goal titles are visible at once, so
titles are short, the introduction is one or two sentences, and anything a
newcomer has to know first, such as a safety note, goes in the first paragraph.

Choosing a goal puts its request in the editable draft of a new or empty
conversation and opens the goal's guide beside it. The guide is static text for
the person: what they get (`what`), when the goal is useful (`when`, one short
sentence) and the steps they take themselves (`steps`). Nothing tracks the
steps. A goal that explains itself can set `guide: none`, which drops the
guide and shows only the title.

Normally the draft waits for the person to press Send. `start: immediate` sends
it on the choice itself, which suits only a self-contained request that the
person has approved for one-press use. It does not apply when the request has
a placeholder, when the draft already holds text, or in Explain mode; then the
goal is prepared as usual.

### The placeholder

A request may end in one placeholder for what only the person knows: a
single-line label in square brackets, on its own after a blank line.

```yaml
prompt: |-
  Etsi vastaus projektin aineistosta ja anna tarkat lähdeviitteet.

  [kysymys]
```

The draft opens with the whole marker selected, so typing replaces it. If the
person sends without typing, the host leaves the untouched marker out, so the
instructions before it have to stand alone and tell the agent to ask for what
is missing. The host moves the marker to the end of the draft wherever it was
written and leaves the surrounding text as it is, which is why a marker inside
a sentence leaves a broken sentence; when refreshing, rewrite such requests
into the form above. Only exactly one well-formed marker counts. Several,
nested, empty or multi-line brackets stay literal text, so keep other square
brackets, Markdown links included, out of a request that has a placeholder.

## Each goal has its own skill

Write each goal's request also as a skill in `.agents/skills/<name>/SKILL.md`
and set the goal's `skill` to that name. Pi then records the request in the
conversation as a skill call, and Open Habitat shows it as a chip in the draft
and the history and finds the guide again after a reload. Without a skill the
request is only text in the draft.

```markdown
---
name: korjaa-ongelma
description: Korjaa havaittu ongelma
disable-model-invocation: true
---
Selvitä ongelman syy. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja
aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.
```

- `name` is lowercase `a-z`, `0-9` and hyphens, at most 64 characters. The
  skill also shows in Pi's `/` list, here and in a terminal Pi, so the name
  must not collide with another available skill.
- `description` is the goal's `title`, character for character. That match is
  how Open Habitat knows the skill belongs to the goal, so a retitled goal
  needs its skill updated too.
- `disable-model-invocation: true` keeps the model from picking the skill on
  its own.
- The body is the complete request without the placeholder.

The goal's `prompt` stays the same request, with its placeholder: the person
reads it from the chip, and the host offers it as plain text if the skill ever
disappears. When a goal is removed, propose removing its skill as well.

A goal can instead name a general skill that is already available in this
session, by its native name without the `skill:` prefix. Its description is
then not the goal's title, and choosing the goal puts the `prompt` after the
skill's invocation.

## File format

The host parses the file strictly. An unknown field, a wrong type or a value
over its limit makes the whole page unavailable, and people then see only a
hint to create or update the page, never a partial one.

The file is UTF-8 Markdown with YAML frontmatter, at most 32 KiB. The
frontmatter holds `title` (1–256 bytes) and `goals` (0–8, in display order);
the Markdown body is the introduction (at most 16 KiB, HTML is not rendered).
A page without goals is valid. Guide fields and titles are plain text, not
Markdown. Quote YAML strings or use block scalars so punctuation stays text.

| Goal field | Limit | |
| --- | --- | --- |
| `title` | 1–256 bytes | required |
| `prompt` | 1–2048 bytes | required; the full request |
| `what` | 1–2048 bytes | required unless `guide: none` |
| `when` | 1–1024 bytes | required unless `guide: none` |
| `steps` | 1–8 strings of 1–1024 bytes | required unless `guide: none` |
| `skill` | a skill name | optional |
| `name` | one line, at most 160 bytes | optional: the name of the conversation the goal starts, when the title is not a good one (`Viikkoraportti` for *Kirjoita viikon raportti*) |
| `guide` | only `none` | optional; guide fields may then be left out and are ignored if present |
| `start` | only `immediate` | optional |

```markdown
---
title: Tervetuloa projektiin
goals:
  - title: Tee pieni korjaus
    what: Saat rajatun muutoksen ja sen testitulokset tarkistettavaksi.
    when: Kun tiedät, mikä yksittäinen asia pitää korjata.
    steps:
      - Kuvaa korjattava asia yhdellä tai kahdella lauseella.
      - Katso agentin tekemä muutos ja testien tulos.
      - Hyväksy muutos tai pyydä tarkennuksia.
    prompt: |-
      Tee tähän repoon pieni, rajattu korjaus. Aja muutetun osan testit ja jätä muutos minulle tarkistettavaksi. Kysy, jos korjattavaa asiaa ei ole kerrottu.

      [korjattava asia]
    skill: pieni-korjaus
  - title: Tutustu projektiin
    guide: none
    start: immediate
    name: Projektin kartta
    prompt: Näytä projektin tärkeimmät osat ja ehdota yhtä pientä aloitustehtävää.
    skill: tutustu-projektiin
---
Aloita **pienestä muutoksesta**, jonka voit tarkistaa itse.

Tiimi ylläpitää tätä sivua yhteisillä commiteilla.
```
