# Result

The picker now explains choosing a dedicated subfolder (including a Downloads
subfolder), moving/saving screenshots there, or attaching individual files.
AbortError produces neutral cancellation-or-refusal guidance: the API cannot
reliably distinguish cancellation, sensitive-folder rejection and denied access.
SecurityError and unexpected failures have separate safe guidance. Raw exception
messages are never rendered. Retry clears the notice; failure preserves any
existing folder grant. Late picker failures cannot affect a disposed identity.

## Evidence

Checked Chromium's current `GenerateBlockPaths` on 2026-10-21:
https://github.com/chromium/chromium/blob/main/chrome/browser/file_system_access/chrome_file_system_access_permission_context.cc

Home, Desktop, Documents, default Downloads and safe Downloads use
`kDontBlockChildren`: selecting the directory itself is blocked, not ordinary
subdirectories. Other sensitive trees (e.g. .ssh and macOS Library) block their
children too, so subfolder access is not promised universally.

MDN documents AbortError's ambiguity and SecurityError's origin/user-gesture
causes: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker

## Scope and coordination

This is a local correction, self-reviewed; no new authority, permission or host
API. `proto-local-files-notice` still owns placement/dismissibility design. Its
prototype should retain the pre-selection restriction and recovery guidance;
this fix deliberately leaves the controls in their current location. No browser
blocklist workaround or new attachment flow is needed: ordinary attachments
already cover a single screenshot in Downloads or on Desktop.

## Validation

- `npm ci --prefix web`: passed (4 seconds).
- `./scripts/test-web-fast.sh`: passed (23.90 seconds), including new error,
  retry, retained-grant and disposed-identity unit cases.
- `cd web && npx playwright test tests/local-files.spec.ts`: 4/4 passed
  (6.6 seconds suite; 227.00 seconds routed command including remote setup),
  with axe checks including the refusal states. Synthetic host-backed Chromium
  evidence, not live Brave/macOS native-dialog evidence.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  `git diff --check`: passed.
- Initial focused wrapper invocation with `--untracked` refused the flag before
  running tests (0 seconds); this checkout's script lacks that documented flag.
  Retried via the requested `npx playwright test tests/local-files.spec.ts`.
- No Go/contracts/packaging changes; no full gate run.
- Not deployed from this worker; no live macOS/Brave picker validation claimed.

Tested the working tree based on `57d0706f` with the code and tests in this commit.
