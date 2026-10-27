# Result: context page (Sivu) draft

The context ring now opens a page over the conversation for Pi and Claude
conversations: Pi's measured total, the parts by Pi's own estimate with the
unexplained remainder as its own row, the next compaction by Pi's own cut
rule and the person's settings, earlier compactions with their summaries and
files, and every turn's usage. The conversation stays mounted underneath and
keeps its position; the ring, the back control and Escape return to it.

## How the host reads it

`GET /api/v1/agents/pi:<id>/context` (daemon, `context_detail_linux.go`) finds
the person's own session as the history read does, reads the file itself
(owned, regular, stable) and pipes the complete records to
`context_detail_helper.mjs`, which calls Pi 1.3's own functions:
`SessionManager.inMemory` + `buildSessionProjection` (what the model sees),
`estimateTokens` (chars/4), `estimateProjectedContextTokens` (measured vs
estimated), `prepareCompaction` with `SettingsManager.getCompactionSettings`,
and pi-ai's `getCurrentSystemMessage` for sections and tools. Nothing is
written, no Pi starts, no path crosses into the helper. The gateway admits the
exact path, query-free. Contract: `contracts/v1/context-detail.schema.json`.

## Evidence

- Go, real pinned Pi SDK on synthetic sessions
  (`TestContextDetailIsPisOwnReading`, `...Boundary`, `...FitsTheDaemonLimit`):
  measured total after a compaction, summarized output excluded, image as
  attachment, per-turn usage, the person's `keepRecentTokens` driving the cut,
  a cut at a shell command inside a turn, size after a compaction, Claude
  bridge sections, 2 MB session through the pipe, oversize reading, 403/404/400.
- Browser (`context-ring.spec.ts`, real daemon route and Pi helper over fake
  Pi's session, which now records a Pi 1.3 system message): ring opens the
  page, focus to heading, axe clean, reload keeps it, Escape and back return
  focus to the ring, compaction listed and no measurement right after it.
- Screenshots at device scale factor 2 in `evidence/`: `desktop-*`/`phone-*`
  from the browser host (`capture.spec.ts`; fake Pi's turns are tiny, so
  almost all of its synthetic usage is "unexplained"), `story-*` from the
  Storybook story with realistic proportions, including the Claude case.
- Review: `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1) found
  four defects, all reproduced by both and fixed with regression tests:
  EAGAIN on a large piped session (Pi's import makes stdin non-blocking),
  bounded fields summing past the output limit, Pi's cut at a shell command
  giving a negative turn the contract rejects, and the post-compaction size
  taken from the wrong reply. A fifth, found in the screenshots: the page could
  read the session before Pi wrote a reply the ring already showed from the
  live stream; it now rereads (up to five times) while its measurement differs
  from the ring's, and the spec asserts they agree.
- Whole browser suite once (`npm run test:browser`, 406 cases, run beside
  other workers on Birch): 394 passed, 9 failed, 3 skipped; all 9 failures
  (editor, attachment documents, queued send, long run, site key, lost reply)
  passed on an isolated rerun, so they are load flakes, not this change.
- On a real Birch session (Claude Opus via the bridge) the estimated parts
  were 108k of a measured 190k; for a GPT session 84k of 88k.

## Decisions for later review

- **Host reads Pi's file and calls Pi's functions in a Node helper**, as the
  models helper does, rather than reimplementing the estimate or cut rule in
  Go or the browser (the prototype's requirement). Alternative: extend the
  history wire and compute in the browser; rejected because the browser holds
  only pages of history and the cut rule changes with Pi.
- **The unexplained remainder is shown, not scaled away.** The prototype
  scaled estimated parts to the measured total. For Claude conversations the
  gap is large (Claude Code's own preset, not recorded, plus tokenizer
  difference), and scaling would attribute it to Pi's sections. So parts are
  Pi's estimate unscaled and "Erittelemätön" carries measured − estimated.
- **Claude: no native `/context`.** Claude Code's `/context` would need a
  Claude Code process resumed on the bridge's session, which starts an agent
  and appends to its transcript on a read; not done. Pi's built-in
  `preamble`, `tools`, `rules`, `docs` and `cwd` sections are marked replaced
  (pi-claude-bridge 0.9.3 sends only project context, skills, addendum and
  custom sections after Claude Code's preset). Pi and OpenAI/Codex have no
  native breakdown command; Pi's session data is the native source.
- **The ring opens the page directly; its popover is gone.** The page has
  everything the popover had. The ring is a toggle (`aria-pressed`). The page
  is in the route (`?context=1`) so a reload keeps it.
- **Turns** are the person's messages; usage per turn is summed over its
  replies (each reply rereads the context), context size is the turn's last
  valid reply. The next-compaction range is placed by entry order, so a cut
  at a shell command or extension message shows as a split turn.
- **Bounds**: newest 20 compactions, 24 000 characters per summary, 500 turns,
  5 largest outputs; when the sum would exceed ~900 kB the oldest summaries
  are dropped first. Compaction numbering counts the shown ones.
- **Settings** are read with `projectTrusted: false`, as the models helper
  does; a project-level compaction override is not reflected.
- The part hues are syntax tokens; the design system has no data palette.
