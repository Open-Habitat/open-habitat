---
name: explain-card
description: Write or revise Open Habitat Explain-mode (? view) cards in Finnish and English, including their screen-element mapping and visual checks. Use when adding a chip, button, panel or row control, filling a missing explanation, or improving a card. Not for general UI redesign or the generated open-habitat-ui agent guide.
---

# Explain a screen part

Be a calm, plain-spoken guide beside the person using Habitat. Explain what
they see, what they can do and what happens next, not how we built it. Write
short, direct Finnish, with equally natural English counterparts.
A good card makes the person confident about the next press without making
them read a manual.

All paths and commands below are relative to the repository root, three levels
above this skill directory. Read `web/AGENTS.md` for the copy and catalog rules,
`design-system/AGENTS.md` for the visual posture, and `TESTING.md` for evidence.

## Find the truth before wording it

Read the target component, its catalog and action handler. Trace the visible
states, disabled reasons, marks and destination: a label alone does not prove
what a press does. Preserve uncertainty where the screen cannot know the state.
Name symbols as seen (↑, ↓, ⋯, a ring or a dot), explaining their meaning rather
than naming an icon library or relying on colour alone.

The live card shape and writing guidance are in `web/src/text/explainMode.ts`.
Read its opening comment and a nearby card in both languages instead of treating
this skill as a schema. `web/src/components/explainParts.ts` ties those card IDs
to elements and gives their kind, shortcut and optional presentation hints.
Use the element's own stable test id or class, not its position, translated
label or sibling count. Add a test id to the owning component if needed.
Check desktop and compact-menu variants: one card can explain both when they
really perform the same action. Reuse an existing matching card; for a new
part choose an unused ID in its relevant group and add it in both catalogs
and the typed parts map.

`web/src/components/ExplainMode.tsx` is the authority for how fields appear.
In particular, `try` is also the touch action label, not just suggested prose;
`grey` and `menu` are conditional notes. For an opening control without `try`,
`opens: true` supplies the opening hint and touch action. `waiting` in
`explainParts.ts` controls which lasting actions the mode blocks: add a new
lasting action's card ID there and verify it waits. Omitting `try` does not
block a press. Safe navigation should still work. Use an existing shared legend when its meanings fit (the
`workerLegend` part flag), not a second, competing list of status meanings.

## Write for the person

Use the on-screen or tooltip name. Let the lead answer what this part is for;
use the extra note for the one consequence, state or restriction that changes
how the person uses it. Explain the relevant marks, what pressing does and
where it leads without repeating the label as a sentence. Let the source's
short length guidance keep the card scannable, not turn it into a word-count
exercise. Optional fields earn their place; a passive indicator needs no
invented action.

Standing rules about how a feature works belong here rather than as permanent
panel filler. Keep immediate errors, current state and reasons a control is
unavailable at the point of use; moving those into a card would hide what the
person needs now. A settings page's self-explanatory rows do not need a repeat
of their inline descriptions.

Implementation paths, file names, protocols, model IDs and storage mechanisms
are not explanations. Actual user content and file/model choices keep their
identifiers, but do not add them as technical background. Agent-only detail can
live in a catalog source comment: the generated agent reference includes it.
No promotional language, exclamation marks or reassurance unsupported by the
handler. For an irreversible action, say what is lost; mention undo or recovery
only when it exists.

Write Finnish and US English together, preserving meaning rather than word
order; use UK overrides only where wording differs. Read the rendered card in
each language. Catalog parity and spelling checks cannot judge the translation.

## Worked example: Git state (Y04)

Find `Y04` in the current catalog and its `[data-testid="git-chip"]` part.
This existing card is a useful model for a status chip that opens details:

| Field | Finnish | English |
| --- | --- | --- |
| name | Git-tila | Git state |
| lead | Näyttää työtilan haaran: ↑ lähettämättä, ↓ tulossa ja muuttuneiden tiedostojen määrän. | Shows the workspace's branch: ↑ not yet pushed, ↓ incoming, and how many files changed. |
| know | Avaa Git-tiedot, joista näet commitit ja muuttuneet tiedostot. Tietojen katsominen ei muuta mitään. | Opens the Git details with the commits and changed files. Looking changes nothing. |
| try | Avaa Git-tiedot | Open Git details |

The lead decodes the visible marks, the note names the destination and the
read-only consequence, and the action uses the same destination. No Git command
or internal path is needed. Use that reasoning, not these sentences, for a new
card; the current source remains authoritative if this example changes.

## Check the result

After changing cards or their mapping, run from the root (with web dependencies
installed as `TESTING.md` describes):

```sh
./scripts/test-focused.sh --area web
python3 scripts/generate-ui-reference.py
python3 scripts/generate-ui-reference.py --check
git diff --check
```

The web checks cover typed catalog shape, `web/src/i18n/catalogs.test.ts`,
`web/src/i18n/finnishScan.test.ts` and `web/scripts/catalog-review.test.mjs`.
For a side-by-side language review, `node web/scripts/catalog-review.mjs`
prints the catalog extract described in `web/AGENTS.md`. Review the generated
reference diff too; edit browser sources, not generated Markdown. Regeneration
can include pre-existing drift: distinguish that from your change.

Look at the actual card in Explain mode in the synthetic lab at 1440 and 390
CSS pixels, in Finnish and English (including effective UK text where it
differs). Enable the Explain-mode experiment and enter through ? or the account
menu; on touch, the first tap explains and the second acts. Check that the
intended element, not its neighbour, gets the card, that the card fits, and that
relevant disabled/menu variants and marks agree with its words. Exercise safe
navigation and verify that lasting effects wait. `web/AGENTS.md` documents the
lab and `web/lab/session.mjs` snapshot helper: save paired screenshots and
static HTML under the issue, using synthetic data only. Run affected browser
specs through `scripts/test-focused.sh` per `TESTING.md` when mapping or action
behaviour changes. Report what was inspected and any blocked or untested state;
a passing catalog check is not visual or interaction evidence.
