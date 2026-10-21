# Aloita tästä — production implementation

## Outcome

New browser conversations show starting goals from effective repository skills and a **Tutustu taitoihin** catalogue. Topic/search and repository/own/new shelves, expandable details, native-description fallback and **Kokeile luonnoksessa** work in the production components. Trying a skill preserves the existing draft and inserts the native `/skill:<name>` plus its optional example **before** the retained text without sending. Pi only expands a skill command at the beginning and requires a literal space before its arguments.

The daemon enriches the existing Pi command read; there is no parallel discovery loader or inventory. Only effective Pi `sourceInfo.path` entries are considered. Bounded metadata reads use `os.OpenRoot` beneath the daemon person's home, reject nonregular/foreign-owned files and nonblocking-open special files, and never serialize paths. Metadata for skills outside that home is unavailable; their native command/description remains visible. Local Git supplies the adding commit author, timezone-aware author time and commit ID. Shallow, unavailable or ambiguous history stays unknown. Repository addition is not a verified author identity or original authorship claim.

## Decisions for later review

- Adopt the optional `metadata.open-habitat-title/topic/when/example` keys and integer `open-habitat-start` (0–10000, ascending; native command name breaks ties). A missing presentation field uses the native name/description, the topic **Muut**, or command-only insertion. Only effective files physically in this repository's `.pi/skills/` or `.agents/skills/` may supply starting goals. Native source scope is not an extra trust decision: an explicit CLI/settings source can refer to the same repository file.
- “New” compares the adding commit’s **author time**, not when a branch was merged or pulled into this checkout. A skill written before the cutoff and merged afterwards will not receive a new badge. Git has no reliable checkout-arrival time; changing to committer time would not fix ordinary merges. Keep the selected timestamp semantics rather than quietly adding arrival tracking; revisit that product distinction only if it matters in use.
- The browser stores only an explicitly acknowledged opening timestamp, scoped to the web identity and an opaque Git-common-directory key. Linked worktrees share that repository cutoff. No automatic acknowledgement, skill inventory, history, per-card tracking or cross-device synchronization is introduced. First visit has no new badges. Failed browser storage is reported rather than silently acknowledged.
- Discovery is an empty-state entry, not an additional conversation-header button. Opening the catalogue rereads the effective native command list; its presentation component performs no IO. No contextual/AI recommendations, metadata generation, writeback, Git fetch or host catalogue store.
- Metadata uses the maintained YAML v3 parser; only bounded scalar presentation fields are accepted. Files outside the person's home fall back to Pi's native description rather than adding broader filesystem reads for presentation.

## Verification

Synthetic, not live-server or distinct-UID evidence:

- `./scripts/test-web-fast.sh`: passed format, lint, TypeScript and 484 tests across 84 unit/production component files.
- `./scripts/test-focused.sh --area browser --spec lab-start-here.spec.ts`: four host-backed cases at 1440/390 px × light/dark. Real gateway/daemon/controller with fake Pi. Checks effective metadata, repository filtering and search, first view, explicit acknowledgement and persistence, retained draft/native command/example, no send, Enter/Escape/focus restoration, bounds and Axe on the open detail catalogue.
- `./scripts/test-focused.sh --area browser --spec lab-composer-area.spec.ts`: six existing composer interaction cases, covering command/file completion, typing focus, queue and phone layout.
- `go test ./internal/daemon ./internal/contracts ./test/browser-host` with `TMPDIR=/var/tmp`, `umask 077`: native boundaries and callers. New tests cover home-escaping symlink rejection, source-path omission, adding-vs-metadata commit, shallow history, scalar YAML fields, and the actual pinned Pi SDK loader's trusted/untrusted collision winners and `sourceInfo.path`.
- `./scripts/check-generated.sh`, `python3 scripts/validate-contracts.py`, Storybook build, project-view validator, issue doctor and `git diff --check`.

Paired synthetic-lab evidence is in `evidence/`: desktop/light and phone/dark entry and expanded detail, AVIF plus offline static HTML. Playwright runs through the installed Fleetrepo warm remote runner; screenshots/HTML were retrieved immediately after capture before another source sync. No live host, personal browser profile or real home was used.

Full gate intentionally not run; the conductor runs it once on main. No deployment or live/provider claim.

## Review

Proportionate independent review: the final feature includes native file reads, so it warranted more than a UI self-review. Claude Fable 5.1 reviewed the bounded diff; GPT-6 Astra independently checked authorization, effective-path provenance, home/UID confinement and response-path omission. Both completed; their outputs are local scratch under `history/`, not the only record of the resolution.

The finder supplied four should-fix candidates. One was confirmed and fixed: Git history now uses `:(top,literal)` repository-relative pathspecs, so an ancestor `.agents/skills` file keeps provenance when the workspace is nested inside its repository, including bracket characters in the filename. A synthetic regression exercises that case. Three were dropped against local evidence: arrival time was not the agreed timestamp semantics; no provenance-budget exhaustion was observed and the proposed batch walk would lose rename semantics; configured-home symlinks are already rejected by workspace admission before this reader runs. The verifier found no confirmed native-boundary defect and recommended a scope-equivalence regression, which was added and passes for project/temporary/user effective sources.

Local native-semantics review also corrected draft insertion to prepend the command with Pi’s literal-space argument separator; the unit/browser cases now prove invocation placement, retained native text, no POST to send/steer/follow-up, no rendered user message and focus restoration. No follow-up issues were filed from speculative residuals.

## Tool/sub-workflow inventory

- Early Go feedback found a descriptor-relative Git cwd error in the first implementation; corrected to the existing held-workspace `/proc/<parent>/fd/<fd>` convention. An initial native command-list test used a permissive shell umask and refused creation; the full native suite passes under the documented `umask 077`.
- Initial fast-web feedback found an unnecessary-dependency lint diagnostic and required Storybook args typing; corrected the retry dependency explanation and made the story wrapper its actual Storybook component. Later fast-web checks pass.
- The remote runner deliberately does not forward arbitrary capture environment variables. The first browser run passed behavior but produced no optional captures. Capture is now explicit in this issue's test; paired evidence was retrieved and checked. A later source sync can restore source HTML over generated HTML, so final pairs were fetched directly after their final capture.
- Optional discovery probes used absent wildcard filenames/old skill paths and rejected generic remote task/command placements. Used the installed documented skill path and existing warm-runner artifact transport instead; no failed probe is used as verification.

Verified implementation revisions: native base `c5a8b248`, production integration `25463216`, native-invocation/nested-path correction `df8edb01`, and the final evidence/delivery commit carrying this result. Logs for the last checks: `/var/tmp/start-here-web-verified.log`, `start-here-browser-verified.log`, `start-here-composer-final.log`, `start-here-go-reviewed.log`, `start-here-gitpath.log`, `start-here-contracts-final.log`, `start-here-storybook-final.log` on Alder. The last complete native suite precedes only issue/evidence metadata edits.

Optional model-performance logging could not publish its scores: the documented `assess-models` helper's one SSH-to-Alder attempt returned `Permission denied (publickey,password)`, exit 3. Review itself is complete and safe to use independently of corpus logging. Scores and error remain at `/var/tmp/start-here-model-assessment.json` and `/var/tmp/start-here-model-assessment.log`; no direct corpus write or credential workaround was attempted.
