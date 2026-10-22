# Result

Monaco is removed. CodeMirror 6 remains the default browser editor and VS Code remains the explicit desktop option. The choice now lives in the person's private `~/.config/open-habitat/editor.json`, read and atomically written by their daemon; the gateway only authenticates, checks write CSRF and relays. Nothing migrates from browser storage.

## Cause and implementation

The previous `editorPreference.ts` read and wrote `nah:editor:v1:<identity>` in localStorage. That deliberately implemented ADR 0028's device-local decision, so another browser could not observe the choice. The new narrow GET/PUT account endpoint carries only the enum and a response-bound web identity. Client observations are in memory, keyed by identity plus CSRF, schema validated, size bounded and refreshed on sign-in/mount and focus. Writes confirm from their reply, never retry automatically, and expose failure in settings.

The daemon uses its mapped home, refuses unsafe/symlinked configuration directories, checks native file ownership/type/size/permissions, and replaces through a private temporary file plus file/directory sync. Missing configuration defaults to CodeMirror without creating files on reads. Settings writes do not start code-server.

Removed Monaco's adapter, lazy import, worker, dependency/transitives, dedicated stories, CSS and engine-specific tests. VS Code's own `.monaco-workbench` selectors remain intentionally: they belong to code-server, not the removed browser adapter. Updated the lasting rules in `internal/AGENTS.md` and `web/AGENTS.md`.

## Validation

Implementation revisions: backend `aed2c968`; browser removal/configuration `73660389`; reviewed controller fixes `1d706407`. Documentation/issue bookkeeping follows separately. Commands used disk-backed `/var/tmp` and Go tests used umask 077.

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` and `npm ci --prefix web`: installed synthetic test dependencies from lockfiles.
- `go test -count=1 ./internal/daemon ./internal/gateway ./test/browser-host`: passed (125.673s, 6.860s, 2.397s). After correcting the synthetic route mount to use its disposable home, `go test -count=1 ./test/browser-host` passed again (2.379s). The production backend was unchanged afterward.
- `./scripts/test-focused.sh --area web`: final pass, 87 files / 489 unit-component tests, formatting, lint and TypeScript. Covers native enum reads/writes, stale/mismatched replies, lost-write non-retry, pending initial choice and retained live frame.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`: final pass, 10 cases. Fresh browser context sees the saved choice, another identity defaults independently, no device preference key is written, compact choice does not overwrite desktop, background choice retains dirty text, file saves/conflicts/identity changes and light/dark 1366/390px axe checks remain covered.
- `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: final pass, 9 cases, including separate-origin VS Code, identity replacement, header/return/focus and compact transitions. Its setup now chooses through the daemon, not localStorage.
- `./scripts/test-focused.sh --area contracts`: passed after adding the schema, fixture, negative enum/identity-field cases and regenerated fingerprints.
- `npm run build --prefix web`, `scripts/package-release.sh --version 0.0.0-editor-config --target linux-amd64 --web-dir web/dist --output .cache/editor-config-package`, and `scripts/verify-release.sh --archive .cache/editor-config-package/open-habitat-0.0.0-editor-config-linux-amd64.tar.gz --json`: passed after `1d706407`. No Monaco adapter/worker text in emitted JS/CSS. This is a disposable package rehearsal, not a deployed release.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and `git diff --check`: passed; doctor retains existing repository-wide image advisories, with no schema violations.

No full gate was run, as requested. Browser checks are host-backed synthetic, not distinct-UID or live-server evidence. No new installed-host isolation claim is made. No layout/theme redesign or screenshot verdict is claimed; that work remains with the parallel editor-settings prototype. No push or deployment was performed.

The removed Monaco-specific cases distinguished tokenizer/worker/keyboard and desktop/phone adapter behavior that no longer exists. Their shared save/conflict/uncertainty, identity, dirty-buffer and compact-layout invariants remain in the CodeMirror controller and browser cases; the background-observation case was retained against the new host preference. No test-time saving is claimed.

## Proportionate review

Independent `/llm-review`: claude-fable-5-1 inspected the bounded implementation and nearby controller; gpt-6-astra independently probed identity/session, stale-reply and filesystem replacement boundaries. Local assessment confirmed two controller defects from the finder: a refreshed preference could discard a mounted VS Code frame, and an early open could choose CodeMirror before the stored choice was known. Both added tests failed on `73660389` (2 failed / 2 passed), then passed with `1d706407`. A stale storage comment was also corrected. The verifier found no surviving defect in its narrower boundary scope; it did not execute tests or independently assess those controller findings.

Review/assessment scratch: `history/review-editor-preference.md`, `history/assessment-editor-preference.{json,md}`. No residual issue was filed. The evidence above stands without those local artifacts.

## Decisions for later review

- Use a dedicated enum-only `~/.config/open-habitat/editor.json`, rather than code-server's settings or an inherited XDG override. It follows the daemon's mapped-home convention and does not make app preferences depend on VS Code. The gateway has no store.
- Reobserve on sign-in/mount and browser focus, not polling or a new host event/cache subsystem. Another device's change is observed when returning to the browser; an already open document/frame retains its engine until explicit closure.
- Missing configuration defaults to CodeMirror. Invalid/unreadable configuration is an explicit settings error; the browser can still use its last confirmed choice/default. No legacy Monaco values or browser-local choices are migrated in this pre-release change.

## Failed attempts and limits

Development checks first found unused test parameters (lint), an untyped AJV result (TypeScript), and Playwright's synchronous `check()` assertion conflicting with confirmed-after-reply radio state. Corrected each and reran successfully; the browser now clicks and waits for confirmation. The first archive verification omitted its required `--archive` flag; the corrected invocation passed. Exploratory file lookups used a few nonexistent guessed paths; scoped listings/searches located the actual files, including the supplied pi-processes skill location.

The optional model-performance corpus write failed once because SSH-to-self on Alder was denied (`Permission denied (publickey,password)`, helper exit 3). No retry or alternate corpus write was attempted. Both reviews and their local assessment completed independently, so this does not block the implementation. Log: `/var/tmp/editor-model-log.err`.
