# Result

The controlled conversation now keeps its local draft editable independently of
send availability. A completion-status read failure previously disabled the
textarea, causing Chromium to blur it; successful recovery did not restore the
person's focus/caret. Host-write guards are unchanged. No automatic refocusing
was added, so completion cannot pull focus from another control either.

## Evidence

Base: `e824aba75af065b849658a3e5925589926f3e868`. Runnable diff SHA-256:
`3773196e0235d75637b2f864738aad707002d2694c5577e5f21e03b7f191cc8b`
(`git diff -- web/src/app/BrowserConversation.tsx web/tests/lab-composer-area.spec.ts`).

A first synthetic normal-completion journey passed before the fix. The final
regression loses the idle status reply at completion, which reproduces the
reported focus loss: before the fix, the focused-field assertion failed and the
textarea was disabled. It uses page keyboard input after completion, not a
locator action that would silently refocus the field. After the fix it checks
focus, insertion at the original caret, blocked Enter/no POST during the outage,
and continued focus/typing after the production status retry succeeds.

Synthetic lab captures (same-UID host, real controller, fake Pi, simulated lost
completion-status reply; no live data):

- Before: [image](before.avif), [static HTML](before.html).
- After: [image](after.avif), [static HTML](after.html).

Capture by setting `OH_FOCUS_CAPTURE` to an absolute output base when running
`lab-composer-area.spec.ts` with `--tag 'typing across'`; convert the emitted PNG
to AVIF with `avifenc`. The screenshots show the outage state before recovery.

## Validation

All final checks passed with `TMPDIR=/var/tmp/oh-composer-build`,
`OH_PORT_BASE=15300`, `OH_BROWSER_WORKERS=2`, and
`PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/.cache/ms-playwright`:

- `./scripts/test-focused.sh --area web`: formatting, lint, typecheck;
  264 unit tests and 191 component tests passed.
- `./scripts/test-focused.sh --area browser --spec lab-composer-area.spec.ts`:
  all 8 cases passed, including the new regression (31.5 s).
- `./scripts/test-focused.sh --area browser --spec lab-composer-focus.spec.ts`:
  both desktop/phone focus-ring cases passed (10.4 s).
- `./scripts/test-focused.sh --area browser --spec shell-accessibility.spec.ts`:
  all 3 keyboard/Axe cases passed (10.5 s).

Non-failing existing diagnostics: Biome template-literal informational notes in
`lab/probe-editor-engines.mjs`, jsdom canvas-not-implemented messages, and Vite
PostCSS/chunk-size warnings. No required check remains failed or incomplete.

## Review and limits

Focused self-review is proportionate: one production prop separates local text
editing from existing send guards; no auth, host contract, Unix-user boundary,
installation or fixture implementation changed. Checked the composer's Enter,
queue and shell execution guards: these still require send/run availability.
The regression additionally checks that the newly editable field cannot issue
a POST while sending is blocked. No independent model review was required.

This establishes synthetic browser behavior, not Ville's exact live transport
failure, real-provider behavior or UID isolation. The live server was not
accessed; no push or deployment was performed. Full clean gate intentionally
omitted for this focused web change.

## Command failures and recovery

- The pre-fix regression failed as expected on `toBeFocused()` (disabled
  textarea); it is the red evidence, not an outstanding validation failure.
- Initial exploratory searches included nonexistent guessed component/module
  paths and an absent fresh-worktree `web/node_modules`; actual paths were
  inspected and `npm ci --prefix web` succeeded.
- Python/Pillow could not encode AVIF (`unknown file extension: .avif`). Retried
  with installed `avifenc`; both conversions succeeded. Only AVIF and static
  HTML evidence are retained.
