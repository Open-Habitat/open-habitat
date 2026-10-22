# Skill chip metadata

The chip now shows the recorded skill name and a short description from the skill file's frontmatter, never an instruction paragraph. Extra user text stays below it. Missing, invalid or unavailable metadata leaves an honest name-only chip. The archived reader omits unused argument-marker lines and presents inline `$ARGUMENTS` references as neutral “kutsun lisäteksti” references; native history and the person's own text are not rewritten.

## Source and decisions for later review

- Reproduced with the installed worktree skill and pinned Pi 1.3.0's actual `_expandSkillCommand`: the wrapper records the name and location, strips frontmatter, leaves the argument marker unchanged, and appends the person's request separately. Regression fixtures retain public excerpts of installed worktree/issue and the shipped start-page skill, plus a description-free shape. Tests invoke Pi's real expansion rather than inventing its output.
- Pi does not archive the frontmatter description. As permitted by the brief, the daemon reads optional **current-file** frontmatter at the recorded location as its own UID. The name and instruction remain recorded facts. No helper Pi, store, cache or endpoint was added. The bounded read accepts Pi's Markdown file and fence shapes, checks the metadata name, refuses special files and never sends the location. Missing metadata is not replaced by prose or an invented summary. Descriptions can change when the installed file changes.
- Metadata is resolved only when entries cross the wire, not during full-session ownership/ancestry scans. History pages and SSE use the same projection; full-instruction reads apply the same marker cleanup before pagination.
- The requested name-plus-description fixes the accepted prototype's description-only chip. The name is monospace above the description; existing tokens, caret, separate own text, 540 px desktop reader and phone takeover remain. Start-page components were not changed.

## Evidence and focused review

`evidence/` contains eight synthetic host-backed AVIF/static-HTML pairs: 1440 and 390 px, light/dark, chip closed and reader open. Compared desktop/light and phone/dark against the accepted Siru side-panel prototype and the preceding implementation captures: reader geometry and controls remain unchanged; the intended difference is the added native name. Phone wrapping stays inside the viewport, and no argument marker is shown.

One targeted reviewer (`claude-fable-5-1`, `/var/tmp/skill-chip-review.txt`) found three concrete edge cases. Verified them against pinned Pi's loader/frontmatter implementation and fixed all three: resolving metadata only at delivery, supporting root-level `.md` skills, and matching BOM/newline/closing-fence variants. Added regression coverage. No unresolved finding or delegated workflow remains.

## Validation

All passed again after rebasing onto `f84b840d` (runnable changes from `d526abcb`; subsequent edits only refresh this result and captures), using disk-backed `TMPDIR=/var/tmp` and `umask 077`:

- `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.
- `./scripts/test-focused.sh --area web`: formatting, lint, TypeScript, 89 files / 502 tests (`/var/tmp/skill-chip-web-rebased.log`). Replaced the obsolete prose-heuristic test with entry-boundary coverage proving that neither body prose nor argument markers supply the label.
- `./scripts/test-focused.sh --area browser --spec lab-skill-invocation.spec.ts`: six width/theme cases; chip and reader axe audits, Enter/Escape/Close/Back, focus return, draft/scroll retention, long instructions/arguments, missing descriptions, long names and HTTP reload (`/var/tmp/skill-chip-browser-rebased.log`). One browser suite at a time on the installed remote runner.
- `npm run build-storybook --prefix web` (`/var/tmp/skill-chip-storybook-rebased.log`).
- `./scripts/test-focused.sh --area contracts`: generated fingerprints and 63 schemas / 69 fixtures / 40 scenarios / 17 negative checks (`/var/tmp/skill-chip-contracts-rebased.log`).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` and `go test ./test/browser-host` (`/var/tmp/skill-chip-{go,host}-rebased.log`).
- Project-view validator, tracker doctor and `git diff --check`.

These are synthetic same-UID host/browser and native-SDK/package checks, not live-provider or distinct-UID isolation evidence. No VM/Fleetrepo changes, deployment or push. The full clean gate was not run, as allowed by the brief.

## Failure inventory

- The first daemon run failed the inline-marker regression because the fixture was expanded to include an inline occurrence after that run compiled the earlier projection. The fix normalizes inline references as well as removing standalone marker lines. Reran against stable inputs; initial log: `/var/tmp/skill-chip-go.log`.
- The first browser matrix exposed a real metadata bug: a large skill body made the initial whole-file-size guard suppress its short frontmatter description. Changed the bound to the frontmatter read, with a large-body regression. Two phone cases also filled the outgoing composer's field during navigation and lost that text on remount; the journey now uses the workspace's direct new-conversation link and waits for its mounted surface. Initial log: `/var/tmp/skill-chip-browser.log`; synthetic failure contexts: `/var/tmp/skill-chip-browser-debug/`. No application startup restriction was weakened.
- Discovery probes used nonexistent guessed locations (`internal/daemon/AGENTS.md`, `GoalGuide.test.tsx`, command/event test globs, `contracts/fixtures`, `core/frontmatter.js`, and `Composer*`); dependency-existence probes also preceded installation. Located the actual files through scoped searches (`internal/AGENTS.md`, `utils/frontmatter.js`, component tests and contract schemas) and installed both pinned npm dependency sets. No required input remained missing. These were discovery misses, not passing checks.

- First `taskfleet run merge` stopped on concurrent changes to the two generated schema fingerprints. Read the upstream start-page contract change, regenerated both outputs from the combined source schemas, and continued the ordinary rebase without changing either worker's components. No terminal report was submitted by the failed merge. All six validation commands passed again on that base before retrying; logs are `/var/tmp/skill-chip-{web,browser,contracts,go,host,storybook}-rebased.log`. Screenshots were refreshed from that browser run. Conflict resolution affected only `internal/contracts/v1_gen.go` and `web/src/contracts/v1.generated.ts`.
