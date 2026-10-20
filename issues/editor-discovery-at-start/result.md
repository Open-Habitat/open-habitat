# Result

The daemon observes operator configuration on demand instead of retaining startup availability:

- Editor status and relay availability re-read the trusted installation file. An explicit start re-reads it under the existing editor lock and uses that snapshot's executable and idle timeout.
- Integration tool lookup re-reads the trusted installation configuration without mutating the shared catalog environment. Every lookup still validates executable ownership and permissions.
- Missing, rejected or removed configuration disables availability; a later valid installation can recover without a daemon restart.

No browser code changed. `WorkspaceEditor.tsx` keeps availability only in a module-local map, not session/local storage; a full page reload clears it and requests status again. No layout or presentation changes, so lab before/after captures are not applicable.

## Validation

On the implementation diff based on `7f8cae2f` (no browser, contract or packaging changes), under `umask 077` with a private disk-backed `/var/tmp/ohed.*` TMPDIR:

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed (existing optional peer-dependency/deprecation warnings; zero audit vulnerabilities).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed with race detector (74.5 seconds).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`: passed with race detector (4.8 seconds).
- `./scripts/test-focused.sh --area contracts`: passed; generated code clean, 55 schemas/fixtures, 37 scenarios and 17 negative checks valid.
- `git diff --check`: passed.

New regressions exercise unavailable → installed → rejected → recovered → removed configuration on one editor handler/tool environment, check that status does not create editor runtime directories, and reject an untrusted replacement executable. Existing file-loader and executable trust checks remain in force.

Independent `/llm-review`: Claude Fable 5.1 finder plus GPT-6 Astra boundary verifier. No supported correctness/security defects. `/assess-findings` dropped four non-actionable observations: warning repetition with malformed operator config, unmeasured relay-read overhead, an unreachable future SyncEntry case (production has only Himalaya), and the test's standard Linux `/usr/bin/true` prerequisite. Local scratch reports are `history/review-editor-discovery.md` and `history/assessment-editor-discovery.{json,md}`; this result preserves the verdict without depending on them. No follow-up issues filed. Performance-corpus logging omitted to respect the no-Fleetrepo-change brief.

Chose independent review because this changes when trusted executable configuration is observed and introduces concurrent live observations; it does not change identity selection or move authority. Full gate and browser checks were not needed for this daemon-only change.

Issue metadata doctor, project-view validation and final whitespace checks passed.

### Failed/incomplete command inventory

- Initial path discovery included nonexistent guessed daemon/server, HTTP, operator-file and production file names, and an incorrect pi-processes skill path. Those reads/searches failed; corrected bounded searches found the real code and supplied skill path. No validation step was omitted.
- Reviewers ran auxiliary tests outside the prescribed environment and reported fake-editor socket-mode failures under permissive umask; the finder also saw a trash fixture deletion failure. Finder reproduced both on clean committed HEAD, then passed the new race-enabled tests. Verifier retried under `umask 077` and passed. The host's complete affected-package runs under the required environment passed independently; these auxiliary failures do not block the deliverable.
- No required check remains failed or incomplete.

## Limits

No test-server access or deployment. This change does not watch configuration or restart already-running code-server/sync processes when a tool version changes. Editor availability in an already-open tab remains cached until a full reload, as permitted by the issue.

## Decisions for later review

None: retained existing authority, trust checks and browser reload behavior. No Fleetrepo installation changes required.
