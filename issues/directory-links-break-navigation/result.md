# Directory links: result

## Cause and fix

`parseFileRef` deliberately accepted only files with extensions. A Markdown directory destination such as `./cmd/` consequently reached `ExternalLink`, whose `_blank` anchor resolved the path against the application URL instead of opening the editor. The browser reproduction confirmed that no file tree opened on either desktop or phone; the implementation explains the stray app navigation in another tab, rather than proving a same-tab departure in the original live incident.

Trailing-slash workspace directories now use the same sanitized Markdown/inline-code/prose reference handling as files. The CodeMirror document controller reveals the directory and loads only its own listing and ancestors. The tree expands that path, clears an obstructing filter, and focuses/reveals the directory row. It never reads a directory as a document, replaces a buffer, asks to discard changes, or pushes a history entry. Listing failures retain the existing tree retry UI. Gateway routing and authentication are unchanged.

## Decisions for later review

- A directory link reveals the existing workspace tree, rather than changing the workspace root or navigating to another page. This preserves conversation/history context and avoids a second selection route.
- Directory opening preserves the current document, including unsaved changes, and opens the picker on phones. Unlike switching files, browsing a directory needs no discard permission.
- Recognize an explicit trailing slash (`src/components/`, `./src/components/`) rather than guessing whether arbitrary extensionless words name files or directories. Absolute/home paths, URLs, traversal and malformed paths remain outside workspace-reference recognition, consistent with file links.
- Clear the tree's current filter and reopen collapsed ancestors for an explicit link; otherwise a successfully loaded destination could remain invisible. Keep unrelated expanded directories intact.

## Verification

All commands used `umask 077` and a fresh `mktemp -d /var/tmp/oh-XXXX` TMPDIR (the maintained scripts normalize TMPDIR to `/var/tmp`). Browser commands used the installed ordinary-command wrapper's remote warm execution, not local Chromium.

- Before the fix: `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts --tag 'directory links'` failed both new cases (1366px and 390px): the directory's child file never appeared after clicking the Markdown directory link.
- `./scripts/test-focused.sh --area web`: formatting, lint, TypeScript and all 94 test files / 562 tests passed.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`: 17 passed, including desktop/phone directory opening, inline-code reopening with a dirty buffer, no dialog, unchanged URL/history length, and browser Back/Forward.
- `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: 9 passed, including existing file-link, layout, session and accessibility regressions.
- `go test ./test/browser-host`: passed after adding the synthetic Pi directory-link reply. No production Go route changed.
- Focused self-review checked reference validation, nested Markdown links, lazy ancestor loading, async directory replies, dirty/saving document lifetime, and existing file-selection behavior.

The final directory regression additionally checks clearing an obstructing filter, reopening a collapsed directory, directory focus, and no new browser tabs. Both final reruns passed: browser-editor 17/17, web 94 files / 562 tests. `git diff --check`, `python3 scripts/validate-project-view.py`, and `issuectl doctor --json` also passed (no schema violations).

Tested source: base `53392dc2034d70791a465fd705fd1c58235dc197` plus the runnable diff in this fix; SHA-256 of `git diff --binary -- web/src web/tests test/browser-host/fakepi.go`: `2d61e378af350b9a6edcab915c8f19b48449769d6c61bcf9c62ebdf7776b8dc0`.

## Integration recheck

Taskfleet's first merge rebased onto newer main and conflicted only in `KOKEILTAVAA.md`. Both the newer published-item entries and this fix's pending entry were retained. The implementation diff is unchanged. Post-rebase web checks passed again (94 files / 562 tests) at `7e061bc32693a397dc33866926151e7e4fffede4`, tree `d8525cb9babbce9d4dcdda7a1643123c7a34fb8e`. The `browser-editor.spec.ts` recheck passed again (17/17); `workspace-editor.spec.ts` also passed again (9/9) on that same tree before retrying the merge.

These are host-backed synthetic browser results, not live-host or separate-UID isolation evidence. No full clean gate or deployment was performed; existing native path confinement is unchanged.
