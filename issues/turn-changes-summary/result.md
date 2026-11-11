# Result: what the agent changed in a turn (experimental)

Implemented as the round 2 prototype's Tiivis with the Aikajana button on the
collapsed line, behind Settings › Kokeelliset ominaisuudet › *Vuoron
muutokset* (`turn-changes`), off by default.

- Under a finished turn's reply: *Muutokset · N tiedostoa +X −Y* and the
  Aikajana button (icon only on a phone). The line opens the file list in
  place inside the turn (not under the composer); a file row opens its whole
  change and *Avaa editorissa · rivi N* through the conversation's existing
  file-link mechanism (`FileLinkContext`, the same as file links and the
  context view). Aikajana replaces the list; a mark opens that one tool card,
  *Lopputulos* the whole change.
- Code: `web/src/app/turnChanges.ts` (aggregation, unit-tested),
  `web/src/components/TurnChanges.tsx` (card), `web/src/app/TurnChangesSource.tsx`
  (feature switch, block reads), wired in `HistoryView.timelineItems` through
  a new `changes` slot of `AgentTurn`. Explain cards K30–K32 fi/en.
- No contract, daemon or authority change.

## Evidence

- `npx vitest`: `turnChanges.test.ts` (several edits to one file netted, edits
  without a read summed, write over a read file diffed vs. unseen write,
  failed calls and partial reads left out, bash `git rm`/redirection/`sed -i`,
  command parsing that stops at `cd`, expansions, globs and here-documents),
  `TurnChanges.test.tsx`; the whole web area 208 files / 1587 tests green.
- Browser `web/tests/turn-changes.spec.ts` against the synthetic host's
  seeded history (`/fixture/history?mode=turn-changes`): feature off → no
  line; collapsed line counts, in-place opening below the reply, file change,
  the real editor opening `src/haku.ts`, timeline and mark detail, phone
  width; axe on the open list and timeline. Green with reply jitter 250 ms ×3
  (12/12). `settings-experimental.spec.ts` green with the new card.
- Screenshots at device scale factor 2 in `evidence/`
  (`<desktop|phone>-<light|dark>-<fi|en>-<1-collapsed|2-file|3-timeline>.png`),
  regenerated with `OH_VISUAL_CAPTURE=1 npx playwright test tests/turn-changes.spec.ts -g evidence`.
- Same-UID synthetic evidence; not tried live on the test server yet
  (KOKEILTAVAA line added).

## Decisions for later review

- **Tool-call arguments are read per block, lazily.** A history page does
  not carry tool-call arguments (the daemon sends only the tool name and a
  `readable` flag), so "computing from history already delivered" was not
  possible as such. The browser reads each edit/write/read/bash call's
  arguments through the existing native block read
  (`/api/v1/agents/{id}/entries/{key}/blocks/{i}`), only when the feature is
  on and the turn comes within ~800 px of the view, and keeps the last 400
  reads in memory across history revisions. Alternatives: a contract change
  putting a per-call summary (path, counts) into the history page (cheaper
  per turn, but a new daemon projection and a second computation of counts),
  or projecting Pi's own `details.diff`/`firstChangedLine` of edit results,
  which the daemon now drops on purpose. Both belong to the later exact-source
  step.
- **Before-text only from a whole read in the same turn.** When the turn read
  the file whole (no offset/limit, no continuation note) before changing it,
  the change is the exact net diff and the editor opens at the first changed
  line. Otherwise edits show as the sum of their cards with a note, and the
  button says *Avaa editorissa* without a line. Alternative: read the current
  file from the daemon on open to locate the line; not done to keep to tool
  calls.
- **A write over an unseen file is *kirjoitettu*, not *uusi*.** Pi's write
  result does not tell a new file from a replaced one, so the tag says only
  that the agent wrote it whole (counts +lines). The prototype's *uusi* would
  be a guess.
- **Commands: only files the command names.** `rm`, `git rm`, `unlink`
  (deleted), `mv`/`git mv` (source deleted, target changed), `cp`, `install`,
  `ln`, `touch`, `tee`, `sed -i`/`perl -i`, and `>`/`>>` redirections. Parsing
  stops at `cd`, `git -C`, `$`/backticks/subshells, globs and here-documents
  rather than guess. A command-touched file has the *komennolla* tag, names
  the command and has no counts. The prototype's binary tag is not built
  (needs disk or Git).
- **Failed and unfinished calls change nothing.** A call with `is_error` or
  with no saved result is left out, also a failed `bash` that may have
  partly run.
- **Only finished turns.** The line is not shown while the turn runs (the
  prototype's *tähän mennessä*); a stopped or failed turn that changed files
  shows it.
- **Editor on phones too.** The prototype hid *Avaa editorissa* below 800 px
  because production then had no editor; production's file links now open
  the phone editor, so the button follows the same mechanism.
- **A turn whose reads fail shows no card** rather than a partial one; the
  read is tried again on the next history revision.
- **Open state is not remembered**, as in the prototype.
