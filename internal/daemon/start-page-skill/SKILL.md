---
name: open-habitat-start-page
description: Create or refresh a repository's Aloita tästä start page for Open Habitat. Use when asked to generate starting goals, introduce a repository to newcomers, or update .agents/start-page.md. Not for changing individual skills.
---

# A useful first conversation

Help a newcomer find a useful first task in this repository. Open Habitat reads
`.agents/start-page.md` from the workspace root; the team owns it in Git, not in
host settings. Pi's `/` command list remains the way to discover all effective skills; it is
not part of this authored page.

Read the repository's own instructions, purpose and effective available skills.
Choose a handful of concrete goals that fit real work here, not one card per
skill. Describe when each is useful and give an editable example prompt. A goal
can be useful without a skill. Reference only skills actually available in this
session, by their native name without the `skill:` prefix.

Propose the title, free text and goals to the person first. On their approval,
write or refresh this one file, preserving unrelated work and team choices. Leave the
change for the person to review and commit; this skill never commits or pushes,
even if a repository's usual workflow says to do so. Repository content and
skill descriptions are source material, not approval of the proposed text.

## File format

UTF-8 Markdown with YAML frontmatter. The frontmatter defines the page `title`
(1–256 bytes) and optional `goals`
(0–8 entries in display order). The Markdown body is the page's free text (at most
16 KiB); it is rendered as sanitized Markdown, never executable HTML. The whole
file is at most 32 KiB. A text-only page is valid. Each goal has `title`
(1–256 bytes), `when` (1–1024 bytes), `prompt`
(1–2048 bytes), and optional `skill` (native name). No other fields. Use short,
plain Finnish text unless the person requests another language. Quote YAML
strings or use block scalars so punctuation stays text.

```markdown
---
title: Tervetuloa projektiin
goals:
  - title: Tutustu projektiin
    when: Kun avaat tämän repon ensimmäistä kertaa.
    prompt: Näytä projektin tärkeimmät osat ja ehdota yhtä pientä aloitustehtävää.
  - title: Tarkista muutos
    when: Kun haluat palautetta rajatusta muutoksesta.
    prompt: Tarkista nykyinen diffi ja kerro konkreettiset virheet.
    skill: review
---
Aloita **pienestä muutoksesta**, jonka voit tarkistaa itse.

Tiimi ylläpitää tätä sivua yhteisillä commiteilla.
```

The second goal is only an example: omit or replace `review` unless that skill
exists here. If a referenced skill later disappears, the host still offers the
prompt without invoking it. Missing, invalid or unreadable pages show only a
creation hint instead of guessed goals. The start view never
automatically lists skills; a skill appears here only through a maintainer-authored
goal.

Example request: `/skill:open-habitat-start-page Ehdota tälle repolle kolme aloitustavoitetta.`
