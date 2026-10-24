# Result

The daemon now removes attachment-only reference lines and matching `Attachment path:` lines before deriving the first-message fallback title. Ordinary Markdown, inline references and unpaired paths remain message content. Attachment-only messages leave the fallback empty, allowing the existing new-conversation title. Native/generated session names and stored message content are unchanged.

## Decisions for later review

- Fix the shared native-history fallback, not individual browser surfaces. `firstPrompt` in `internal/daemon/history_linux.go` now calls `fallbackTitle` in `internal/daemon/title_linux.go`, so snapshot discovery and all its title consumers receive the cleaned text.
- Match `messageText` in `web/src/components/AttachmentChips.tsx`: recognize whole-line image/file references to attachment UUID URLs; remove absolute host paths only for IDs from those references. Do not broadly strip Markdown or arbitrary path-looking text.
- Strip before the existing 80-rune/160-byte bound, so a long attachment name cannot consume the title or leave a partial reference. Model input and generated names stay outside this fallback-only fix.

## Focused self-review

Checked both regexes against the browser rule, including exact line matching and ID pairing independent of line order. Checked that native history remains unmodified, explicit/native names still win, and existing UTF-8 limits remain intact. Extended the native-history regression to put an oversized attachment reference before multibyte text; unit cases cover image/file pairs, metadata-only input, paths before references, ordinary Markdown, inline references, malformed references, unrelated/relative paths and preserved line breaks.

## Verification

Tested the runnable diff against base `04ef2c15` (the three Go files in this delivery), with Go 1.27.1 and Node 22.23.2:

- `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)` for the Go/check shell (the focused script itself sets disk-backed `/var/tmp`).
- `go test ./internal/daemon -run 'TestFallbackTitle|TestFirstPromptFitsSnapshotTitle' -count=1` — passed.
- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` — installed the pinned synthetic Pi prerequisite; npm reported existing peer-dependency warnings and five audit findings. No lockfile or dependency changes made.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` — passed, 142.680s.
- `./scripts/test-focused.sh --area contracts` — passed generated-contract drift and schema/fixture validation (65 schemas, 74 fixtures, 40 scenarios).
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check` — passed.

No full clean gate, browser or live-server test is claimed; no browser code or interaction changed. Tests use synthetic histories and homes, not live user data.
