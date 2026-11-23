# Start-page skill fact-check — 2026-11-23

Checked `internal/daemon/start-page-skill/SKILL.md` after rewrite commit
`d9afaaede1277f6c5dadeed844fe0308e41fdfda`. The worker started at
`8f5b66aeced16709535991289fa64511d530edd7`; the relevant implementation and
instruction files still matched main at `ccae6be9d67989109aa29de11f281f48e68c3082`.
Only factual corrections were made; headings, examples, approval before writing,
Finnish default, refresh policy and the instruction to leave work uncommitted stay.

## Corrections and evidence

| Correction | Evidence |
| --- | --- |
| The page is read from the local workspace, including uncommitted edits; teammates see equal pages only with equal files. A commit records the page, rather than itself publishing it to everybody. | `readStartPageFile` in `internal/daemon/start_page_linux.go` opens `.agents/start-page.md` directly, without consulting Git. |
| Pi's slash list shows loaded skills normally, not unconditionally every skill. | Installed Pi 1.5.2 `docs/skills.md`: discovery, project trust, collisions and `enableSkillCommands`; installed interactive command-index configuration uses `getEnableSkillCommands()`. |
| Choosing a goal does not automatically open its guide on a phone. The static text is split between the goal and guide, not all in the guide. | `guideOpensItself` and `setGuide` in `web/src/app/goalGuide.ts`: widths at most 800 px stay closed; `guide: none` is always closed. `StartGoals` renders `when` on the goal card; `GuidePanel` renders `what` and `steps`. |
| Skill names also exclude leading, trailing and consecutive hyphens. | Installed Pi `dist/core/skills.js`, `validateName`, and `docs/skills.md`. These are authoring constraints; Pi warns about invalid names rather than rejecting all of them. |
| Goal-owned skill matching trims outer whitespace before comparing description and title. | `resolveGoal` in `web/src/app/goalGuide.ts` compares `skill.description.trim()` and `goal.title.trim()`. |
| YAML types are not universally strict: number and boolean scalars can become strings. With `guide: none`, guide values skip size/content checks but must still decode. | `parseStartPageDocument` decodes with `go.yaml.in/yaml/v3`, then clears guide fields before checking lengths. A temporary synthetic Go probe confirmed `title: 42` and `title: true` become strings, an oversized no-guide `what` is accepted, and a mapping-valued `what` or scalar `steps` is rejected. The probe was removed after passing. |
| Conversation `name` rejects outer whitespace and ASCII control characters as well as multiline/overlength values. | `validTitle` in `internal/daemon/title_linux.go`, called by the page parser; existing `TestStartPageRejectsInvalidDocuments` covers padded, multiline and overlength names. |

## Other claims checked

- Workspace location, UTF-8, frontmatter delimiters, whole-file/body/field byte
  limits, zero-to-eight ordered goals, required guide fields, optional skill,
  `guide: none`, `start: immediate`, and whole-page failure: parser above and
  `internal/daemon/start_page_linux_test.go`. Whitespace-only required text fails.
- Workspace first paragraph and disclosure, page title and uncollapsed goal
  list: `web/src/components/WorkspaceIntro.tsx`. New conversations use the same
  page goals through `StartPageRead.tsx` and `StartHere.tsx`; the latter renders
  the full introduction. Guide fields are plain React text in `GuidePanel.tsx`,
  and the introduction uses the sanitized `MarkdownRenderer.tsx`, without raw
  HTML parsing. No progress tracking is attached to the guide steps.
- Placeholder recognition, selection, relocation and malformed-bracket fallback:
  `goalRequest` / `goalDraft` in `StartHere.tsx` and `usePreparedField` in
  `goalGuide.ts`. `cutPreparedPlaceholder` in `composer/GoalChip.tsx` removes only
  the still-prepared suffix, and `Composer.tsx` calls it on send. The surrounding
  request is trimmed at its outer edges, not repaired internally.
- Immediate-send opt-in, placeholder/draft refusal and Explain fallback:
  `goalStartsImmediately`, `prepareGoalConversation`, `StartPageRead.tsx` and
  `WorkspaceLanding.tsx`. Creation must actually begin; a model chooser alone
  does not enqueue a later send.
- Goal-owned versus general skill calls, missing-skill fallback, chips and guide
  recovery: `resolveGoal`, `composerGoals`, `conversationGoal`, `readFirstSkill`,
  `goalDraft` and `GoalChip.tsx`. Pi's installed `_expandSkillCommand` loads the
  skill body and appends supplied arguments; `formatSkillsForPrompt` excludes
  `disableModelInvocation` skills. `.agents/skills/<name>/SKILL.md` discovery is
  documented in the installed Pi skill guide. No named external skill is required
  by either example.
- Embedded skill installation and browser reuse: `installStartPageSkill`,
  `TestBundledStartPageSkillIsMaterialized`, and
  `web/src/app/startPageRequest.ts`. No test pins a corrected phrase, so existing
  tests needed no edits.

## Installed tools and main

Read the installed help and version surfaces: Open Habitat **0.1.6** at
`41c214dcba83b80a5d491cea5e649ce2a7aca9da`, Pi **1.5.2**, Taskfleet **0.20.0**
(`taskfleet version`, not unsupported `--version`), and issuectl **0.21.0**.
The skill contains no Taskfleet or issuectl command recipe. The Open Habitat
CLI source has no start-page validation command; no nonexistent command was
added. The browser's preview check is not an agent CLI.

The installed Open Habitat revision precedes the rewrite. Its page parser,
`StartHere.tsx` and `goalGuide.ts` have no diff against inspected main; the
start-page skill itself does differ. This correction targets the source shipped
with main as requested, not an installed generated copy. Pi's installed version
also matches the repository's native Pi fixture dependency.

## Verification and limits

- `umask 077; ./scripts/test-focused.sh --area go --go-package ./internal/daemon`
  passed, including the temporary YAML probe; it also passed after removing the
  probe. The final run passed in 248.493 seconds with the final instruction bytes.
- `git diff --check`, `python3 scripts/validate-project-view.py` and
  `issuectl doctor --json`: passed.
- No browser session, real user's start page, remote clone propagation, provider
  request or live installation was changed or exercised. UI claims are
  source-checked, not a new visual/browser-test result. The focused runner skips
  web, browser, standalone contracts, packaging and the clean-gate receipt.
- No factual correction needs Jari's decision. Existing editorial questions in
  the earlier rewrite result (such as Finnish by default) remain policy choices,
  not facts this pass changes. Instruction obedience and a team's actual Git
  sharing habits cannot be established by parser tests.

The tracking issue was filed through intake without a lane and with the exact
originating run. Its acceptance and delivery closure implement the explicit
request to complete this bounded work; no scheduling lane was assigned.
