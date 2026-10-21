# Phase 2 result

Run `01m5g1479jzwvzbwc6xqv2pzfc`. No push, deployment or publication.
Implementation commits: `82063514` and `fa99bb04`; subsequent evidence/closing
commits are in this issue's git history.

## Delivered

Desktop Monaco uses the existing one-document browser controller and confined
file API. Settings only records the identity-local enum. The selected engine
loads on document open, with selected lazy syntax tokenizers, one same-origin
core text worker, design-token themes, a named accessible textarea, Finnish-keyboard
Save and the existing header/full-window/focus controls. Model disposal releases
the native Monaco core worker; reopening renders a fresh editor. Upstream last-model disposal resets the worker
manager; the browser separately verifies actual worker termination.
There is no language server, extension host, project execution, preview, CDN,
new host authority or changed CSP.

Compact layouts keep CodeMirror without overwriting the desktop preference.
Dirty resizing asks for explicit discard and respects refusal; a saved document
can change engines without losing content. Growing does not switch a live
CodeMirror document; a later clean open uses the stored desktop choice.

## Verification

All browser/lab evidence is synthetic, production-bundle, Linux ARM64 Chromium
through Fleetrepo's isolated remote runner, never a personal profile/live server.
Ordinary Go/static/build checks ran natively. The full gate belongs to the
conductor and was deliberately not run.

| Check | Result |
| --- | --- |
| `./scripts/test-web-fast.sh` | Passed: formatting, lint, TypeScript, 488 tests in 86 files. |
| Affected Playwright specs: `browser-editor`, `workspace-editor`, `account-settings`, `file-tool-cards`, `refresh-identity` | 48 passed. Includes both engine adapters, saves/conflicts, compact override with persisted Monaco and zero Monaco fetch, both themes, axe audits, delayed old-identity reads, dirty resizing, local workers and no editor grants. |
| Final `browser-editor.spec.ts` | 18 passed after adding explicit Monaco Ctrl+Alt+K focus/return and zero engine fetch before opening (including settings selection), word editing, indentation, Tab-mode toggle, Save from find and background preference retention. Keyboard save, uncertain reply, explicit comparison, worker termination/reopen and identity disposal covered. |
| `lab-browser-editor.spec.ts` | 4 passed: 1440/390 × light/dark screenshot + offline HTML pairs in `evidence/`. Desktop is Monaco; 390px retains Monaco preference but renders CodeMirror. Save stays in the viewport; no horizontal document overflow. Captures inspected, not visual regression assertions. |
| `go test ./test/browser-host ./internal/daemon ./internal/gateway -count=1` | Passed. No host runtime or contract code changed; distinct-UID proof remains phase 1's evidence, not these same-UID/browser checks. |
| `./scripts/test-focused.sh --area contracts` | Passed generated drift and validation: 62 schemas, 67 fixtures, 40 scenarios, 17 negative checks. |
| `npm run build-storybook --prefix web` | Passed; real production Monaco editing/conflict stories added. |
| Production Vite build and release packaging/verification | Passed. Archive `open-habitat-0.0.0-monaco-linux-amd64.tar.gz`, SHA-256 `15df5ad33a11f492ac3e844dd81b77c5ee64a540a5fb896aabe1957d2b040efc`, embeds source `fa99bb04`. No release/gate claim. Worker and all lazy chunks are included by the existing recursive asset packaging. |
| `./scripts/test-package-socket.sh <archive>` | Passed: re-signed unsafe units/inventories rejected. |
| License boundary, project-view links, whitespace, issue metadata | Passed, Monaco MIT and pinned transitive licenses reviewed; ADR 0028 retired with lasting rules in `web/AGENTS.md`. |

Final combined remote job (48 affected browser cases + 4 lab captures):
`bca6fba4bd993ff678dccb5122e53c8d97f85bf9c4b07bc85599346767f722be`.
Receipts/logs fetched under `/var/tmp/monaco-*`; committed captures and this
result stand without those temporary artifacts.

## Assets

Fresh Vite manifest closure, each asset independently gzip level 9 (not a timing
or HTTP compression claim). Machine-readable filenames/sizes: `evidence/assets.json`.

| Asset closure | Compressed bytes |
| --- | ---: |
| Initial static JavaScript, including shared imports | 514,876 |
| Initial JavaScript + CSS | 549,457 |
| Incremental controller + CodeMirror + CSS before a grammar | 101,705 |
| Incremental controller + Monaco + CSS before a grammar/worker | 774,931 |
| Monaco engine JavaScript alone | 751,112 |
| Local `editor.worker` JavaScript | 92,187 |

Grammar chunks load separately on encountering their language. CodeMirror and
compact opens request no Monaco assets/workers; settings selection imports no
engine. Worker test checks same-origin URLs under the unchanged app policy,
termination on close and safe reopening. Vite's large-chunk warning is expected
for this explicit optional desktop engine, not suppressed or moved into initial
code.

## Decisions for later review

- Monaco intentionally provides local syntax editing, not TypeScript project
  compilation, extension compatibility or cross-file IDE intelligence. The much
  larger optional engine is worth trying because Jari requested all three.
- Disable Monaco's experimental native EditContext in favor of its established
  textarea, for consistent browser/assistive input and the shared focus target.
  Tab leaves the editor by default; physical Ctrl+M toggles indentation/Tab input
  locally with visible Finnish help. Ctrl+S also saves from the find textbox.
- Another tab's preference never prompts over typing: retain the current engine
  through save, then adopt the stored choice on the next closed opening,
  including a direct FileRef link. This avoids surprise discard confirmations.
- Retain phase 1's native discard confirmation for explicit close/resize rather than add a second dialog
  system. Refusing a compact transition keeps the dirty desktop engine alive;
  no new Monaco load occurs for an initially compact document.

## Tool/sub-workflow inventory

- First fast-web run failed formatting after a broad CSS edit duplicated the
  focus rule inside the compact media query. Removed the duplicate, formatted
  and reran successfully. Final check includes the new parameterized tests.
- Browser integration attempts exposed minified short hex tokens rejected by
  Monaco and a hidden IME textarea selected under experimental EditContext.
  Expand short hex values and use the stable textarea mode. Tests also waited
  only for Save to disable (which includes in-flight); now they await clean
  document state before checking committed bytes. Subsequent complete affected
  suite and final 18-case browser run pass, with no skipped assertions.
- Runner discovery found ordinary commands currently placed natively, no
  repository declaration, and a restricted guest SSH endpoint. Used the
  maintained legacy `oh-browser` API and disposable example-based named tasks
  for the bounded affected suite/lab; no placement policy or service changed.
  The first wait observer recognized the wrong terminal vocabulary and was
  intentionally stopped; replacements use actual terminal states and completed.
- First remote lab attempt hit occupied 24040–24043 listeners. Retried its
  disposable declared task with `OH_PORT_BASE=32000`; all four cases passed.
  No unrelated listener was stopped. Initial fetched failure evidence remains
  `/var/tmp/monaco-lab-evidence`; final captures are from the passing final combined job only.
- Packaging itself and archive verification passed first time. An extra
  socket-package regression invocation omitted its required archive argument;
  rerunning with that argument passed.
- The first shared refusal fixture omitted its required HTTP status; TypeScript
  caught it before runtime tests. Added status 415 and the full fast check passes.
- The first keyboard/find regression used an upstream `input` selector where
  Monaco renders a textarea. Switched to roles scoped to the real adapter,
  without English label assertions; final 48-case run includes its saved-byte proof.
- Source discovery included absent guessed controller/type filenames and a
  nonexistent dependency grammar directory. Scoped reads found the actual
  files/exports; no implementation or test was substituted or bypassed.

## Not claimed

No live server/provider use, separate-UID isolation newly established in this
phase, filesystem-wide CAS against native writers, full-gate receipt, release,
push or deployment. Review disposition is recorded separately in `review.md`.
