# Interim overwrite confirmation

The existing compare/rebase flow is unchanged. Its action now says that keeping the local text makes the next save replace the disk changes. That save is labelled as replacement and asks for explicit confirmation naming the disk/agent changes that will be replaced. Cancelling does not issue a write or discard the buffer. The guard lives in BrowserDocument so the button and keyboard save share it. Refused/uncertain attempts do not clear the guard; a successful save or explicitly opened fresh document does. The daemon's base-version check remains unchanged.

## Focused self-review

Reviewed the controller flag lifecycle, both save entrypoints, cancellation before mutation, failed-save retention and fresh-open/success reset. No merge algorithm, autosave, force-write, host authority or persistent state was added. The wording is deliberately neutral about the source of disk changes because this flow cannot establish who wrote them.

The existing browser conflict journey is extended across desktop/phone and light/dark: cancellation through both Save and the keyboard shortcut must leave the disk bytes unchanged and issue zero PUT requests; accepting then saves the local bytes. A controller regression also covers refused-save retry consent and returning to ordinary saves after success.

## Verification

Tested source: base `76dd4db6` plus the four edited web files in this commit; no production code changed after these checks.

- `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); ./scripts/test-focused.sh --area web` — passed format, lint, TypeScript and 563 tests in 94 files.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts` — 17 passed (50.8 seconds), including the extended conflict journey in both widths/themes and existing axe checks.
- Production web build and synthetic Go host build passed.

Browser placement: Chromium/Playwright, Vite and the unchanged editor spec ran on Cedar (Node 22, private case-sensitive disposable checkout). A disposable test-harness adapter replaced only the host spawn with SSH plus a per-worker localhost forward to the freshly built synthetic host on Alder; each case still started its own host, clock, identities, fake Pi and filesystem. Global host-build/teardown hooks were omitted in the remote copy because build/ownership belonged to the native side. These harness changes are test working material, not product changes. All production editor code and assertions were unchanged between local and remote inputs.

Earlier attempts did not pass: native macOS cannot build the Linux-only host; root in the remote Linux container was correctly refused for writes; an ordinary container UID still encountered `file_unsupported` before the regression path because SELinux supplies `security.selinux` file attributes (confirmed by `listxattr`). The final split-host run avoids those environment differences without relaxing product checks.

Browser evidence uses synthetic host/user data, not live homes or providers, and does not establish distinct-UID isolation. No full clean gate is required for this focused web change.
