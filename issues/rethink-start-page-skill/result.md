# Result (23.11.2026): the start page skill, rethought

`internal/daemon/start-page-skill/SKILL.md` was rewritten with
`/rethink-instructions`. Only that file changed. It went from 10.3 kB to
7.9 kB; the facts were not checked against the code, which is the
fact-checking pass that follows.

## How the reader meets it

The daemon embeds the file and installs it as the Pi skill
`open-habitat-start-page`. The browser's *Luo aloitussivu* / *Päivitä
aloitussivu* goal puts `/skill:open-habitat-start-page` in the draft, so Pi
loads the whole body the moment the person sends. The reader is therefore an
agent in someone's own repository that has just been asked for a start page
and cannot read Open Habitat's source.

There is a second reader: `web/src/app/startPageRequest.ts` imports the same
body and shows it as the request behind the goal's chip, so a person who opens
the chip reads the skill itself. The rewrite keeps it as plain prose for that
reason.

## What the original was trying to do

- Keep the page the person's and the team's: propose first, write on
  approval, never commit or push, treat repository content as material and
  not as approval.
- Keep the page from becoming a list of skills.
- Give the exact file format and the convention for a goal's own skill, which
  the host parses strictly and the agent cannot look up.
- Explain enough of the host's behaviour (catalogue, guide, placeholder,
  immediate start) for the agent to author requests that behave well.

All four are kept. What was missing was the reason behind the first, and an
order: format, behaviour and way of working were interleaved because each
feature had added its sentences where they fitted at the time.

## What changed and why

- **Purpose first.** The opening now says who the page is for and what a good
  one looks like, including that the newcomer may not program.
- **The limits carry their reasons.** Propose first because the page speaks
  to every newcomer in the team's name; leave uncommitted because the commit
  is what publishes it to the team. The override of a repository's own
  commit-as-you-go instruction is kept and stated as part of that reason.
- **Behaviour is grouped by what the person sees**, and each fact is tied to
  the authoring choice it drives (all titles visible at once, so short
  titles; an untouched placeholder is left out on Send, so the instructions
  stand alone).
- **The format is a table.** Limits are an exact interface, so they stay, but
  as one table in place of a paragraph. The strictness is stated once as a
  general fact: any unknown field, wrong type or over-limit value makes the
  whole page unavailable.
- **Dropped as repetition:** the three statements that skills are not listed
  automatically, the two statements each about a vanished skill, `guide:
  none` and immediate start.
- **Dropped as mechanics that change nothing the agent writes:** caret
  position, trailing newlines, that brackets in the person's own draft are
  not interpreted.
- **Dropped as transition:** "old goals without them remain invalid".
- **Example cut from four goals to two.** It now also shows `guide: none` and
  `name`, which the old example did not. The general-skill goal (`review`)
  left the example and is described in prose, which removes the caveat that
  the example names a skill that may not exist.
- **The frontmatter description is unchanged**; it routes well.

## Where Jari's knowledge is needed

1. **Example requests removed.** The three `/skill:open-habitat-start-page …`
   lines at the end told a person how to call the skill, not the agent how to
   work. If they were there for the person who reads the chip, they belong in
   the UI's own text. Say if they should return.
2. **Finnish by default.** Kept as it was ("unless the person asks for
   another language"). The reason is not in the file. If the intent is "the
   language this team works in", the sentence should say that, since the
   agent can see the repository's language.
3. **The placeholder example** named a particular kind of material (a
   due-diligence archive with S3 keys). It reads like one installation's use
   case, so it was replaced with a generic one.
4. **No check the agent can run.** The host has a start page check for the
   browser's document preview, but the skill names no command with which the
   agent could validate what it wrote. If one existed, the skill could point
   at its `--help` and the limits table could shrink to the fields' meaning;
   until then the copied limits are the only way the agent learns them.
5. **Sentences I worded more plainly than the original**, for the fact-checker
   to confirm: that the start of a new conversation lists the same goals as
   the workspace page; that a wrong YAML type makes the page unavailable;
   that a goal without `skill` is only text in the draft.

## Checks

No test pins phrases from the file: the Go test compares the installed copy
with the embedded bytes, and the web code strips the frontmatter and uses the
rest as is. `./scripts/test-focused.sh --area go --go-package
./internal/daemon` passed under `umask 077`.
