# Phase 1 result

Run: `01m5fszedam73p2semdqmrk27e`. Nothing has been pushed, deployed or
published. ADR 0028 remains for phase 2.

## Delivered

Confined daemon read/list/stat/save-existing API and gateway relay; one-document
CodeMirror 6 default with lazy grammars, identity-local Editori settings, compact
layout override, file picker and conversation links/ranges, explicit Save,
comparison/reconciliation and dirty-transition protection. Existing separate-origin
VS Code remains selectable; Monaco is visibly unavailable in this phase.

Actual binding changes dispose documents and abort reads. A transient stale
snapshot does not discard a buffer. A disappearing workspace observation also
cannot discard dirty text: the document keeps its original resource binding
until an explicit transition. Browser back/forward is guarded through the
existing router's data-router support; full-page unload uses the browser's
unsaved-work protection. No file text, path or version token is persisted.

Security evidence distinguishes descriptor confinement, kernel-UID isolation
and synthetic browser behaviour. Saves reject unsupported metadata, serialize
workspace/place aliases, stage and fsync before replacement, reobserve before
rename and return a post-rename token. Reads remain available for owned readable
text whose metadata makes replacement unsupported. Managed deletion and its
preview account for overlapping file-operation roots. Native uncooperative
writers can still race the final check/rename; this is not filesystem-wide CAS.

## Verification

Production implementation: `5b557666` (daemon) and `a610cb6a` (browser), with
additional security cases in `d597c3a0` and `98e61989`, and browser resource
fixes in `b851525f`, `629a168e` and `912a4128`. The boot-backed receipt records
`b851525f`; no later edit changes daemon or gateway code.

| Check | Result |
| --- | --- |
| `./scripts/test-web-fast.sh` | Passed: format, lint, TypeScript, 484 unit/component cases in 86 files. |
| Focused `browser-editor.spec.ts` | 9 passed: default/lazy engine and no grants/Monaco, saves/conflicts/reconciliation, both themes at 1366/390, identity-local settings, delayed old-user reads, dirty navigation, transient stale/workspace-loss preservation and observed worktree root selection; axe audits included. |
| Focused `workspace-editor.spec.ts` | 9 passed: existing VS Code relays/origin isolation, links, keyboard, header/focus/full-window return, phone fallback and one compact-decision prompt per crossing. |
| Focused `account-settings.spec.ts`, `refresh-identity.spec.ts`, `file-tool-cards.spec.ts` | 13, 6 and 2 passed respectively. |
| Focused `lab-browser-editor.spec.ts --lab` | 4 passed, with adjacent PNG/static HTML pairs for 1440/390 × light/dark under `evidence/`. Dirty text and reachable Save are visible. Synthetic lab only. |
| `go test -race ./internal/daemon ./internal/gateway ./test/browser-host -count=1` | Passed. |
| `go test -race ./internal/daemon ./internal/gateway -run TestEditorFiles -count=1 -v` | Passed, including Unicode/surrogates, traversal/symlinks/swaps, FIFO/socket, caps/newlines/BOM, metadata and modes, alias serialization, deletion leases/preview, stale/consecutive saves, disk-full/fsync uncertainty and staging-name ownership. |
| `./scripts/test-editor-files-uids.sh` | Passed: real kernel UIDs 21001/21002 and gateway 21003, own reads/writes, foreign IDs/ownership/peers denied; bind-mount and character-device refusal; capability xattr replacement refusal. Networkless rootless container, not installed-host evidence. |
| `./scripts/vm-test.sh two-user-routing --json` | Passed: systemd PID 1, actual UIDs 21001/21002/21003, authenticated own reads/saves, stale/traversal/foreign-workspace denials, original routing/credential/token-scan checks. Receipt: `evidence/two-user-routing.json`. Native Pi status is synthetic; no actual Pi prompt/controller claim. |
| Contract generation/drift and `python3 scripts/validate-contracts.py` | Passed: 62 schemas, 67 examples, 40 scenarios. |
| Storybook production build | Passed; stories import the real browser editor and show editing, saving, conflict and empty/truncated states. |
| Packaging | Two byte-identical test archives; verification and package-socket regression passed. Test archive SHA-256 `b6cec181a34d6edc38fee5397ee342d44b32b8c5118afdb819e6388dfa272a83`, built with embedded source `b0ddb5d0`. Not a release or clean-gate receipt. |
| License boundary, documentation links, whitespace | Passed. |

The full gate was deliberately not run; the conductor owns it. Browser and lab
runs used Fleetrepo's remote runner and invented users/homes, not a personal
profile or live server. Ordinary Go skips of the distinct-UID/mount/capability
cases were replaced by their explicit disposable-container execution.

## Assets

Measured from a fresh production Vite manifest, each file independently gzipped
at level 9 (not an HTTP timing or a size budget):

| Asset closure | Compressed bytes |
| --- | ---: |
| Initial static JavaScript, including shared imports | 514,697 |
| Initial JavaScript + CSS | 549,278 |
| Incremental browser controller + CodeMirror + CSS, before a grammar | 101,429 |
| CodeMirror engine JavaScript alone | 95,731 |
| Incremental browser editor with all selected lazy grammars available | 223,384 |

Grammar increments share chunks and must not be summed independently. No Monaco
assets/workers are present. Browser cases verify that CodeMirror is not fetched
before opening and that opening it fetches neither Monaco nor editor grants.
Settings/read/list/stat do not start code-server.

## Independent review

See `review.md`: complete finder `claude-fable-5-1` and verifier `gpt-6-astra`,
followed by persisted `/assess-findings` assessment. Five primary findings were
confirmed and fixed: stale-phase buffer loss, repeated compact prompts,
read-versus-save metadata policy, invalid-input Save lockout and deletion-preview
leases. The verifier checked the fixes; host tests supply execution evidence.
The later resource-binding delta received another independent finder/verifier
round: background observations are now non-interactive, and accepted route
discard permission expires after that commit. The controller tests exercise
permission expiry; the browser test checks zero background dialogs. No
unresolved review residual was filed. Performance logging was disabled to
honour the no-push instruction.

## Tool/sub-workflow inventory

- Initial web checks exposed lint/type errors, outdated VS-Code-only test setup,
  and non-idempotent first formatting of new mock chains. Corrected and rerun to
  a passing fast check; no checks were bypassed. Browser failures also exposed a
  fixture file gated on code-server and invalid refresh triggers in new tests;
  the final affected specs pass.
- Initial daemon tests used the wrong synthetic Host and assumed mode bits that
  umask 077 had removed; corrected the fixtures. Initial kernel-UID evidence
  lacked the gateway socket group; the namespace-root coordinator now prepares
  the intended permissions. Final package and UID checks pass.
- Lab exploration caught a real `O_PATH|O_NONBLOCK` openat2 rejection and a mobile
  global navigation control overlapping the editor header. Both were fixed;
  recaptured pairs are the final production UI.
- The old two-user VM fixture omitted current proc/agent/revocation units,
  gateway state/default quota and the current Pi status-stub manifest version.
  Repairs exposed missing quota drivers, a seed-disk slot assumption, dropped
  optional-drive arguments, a misplaced QEMU serial option and incorrect OS boot
  priority. The final guest uses a dedicated serialled ext4 home disk, exact-ABI
  checksum-pinned Ubuntu quota modules and real enforced native quotas; no
  production guard was bypassed. An obsolete assertion forbidding even one's
  own native workspace path was replaced with explicit other-person/symlink
  exclusion, matching the current details contract. The final boot-backed run
  passes all original security checks plus editor reads/writes/denials.
- A final legacy-editor regression exposed coalesced CDP resize events, not a
  product failure. Its test now observes a rendered wide frame before asserting
  a second breakpoint crossing; the complete affected browser suite passes.
- Additional offline VM checks exposed stale test copies of the already-current
  Fleetrepo pin, non-recursive copying of newly present systemd drop-in folders,
  and an old inline-QEMU source assertion after extracting the launch recipe.
  Their strict tests were aligned with existing sources; the complete offline
  VM fixture/negative suite passes. A trace initially polluted redirected JSON;
  separate xtrace output recovered the diagnosis. Late controller regressions
  also needed a baseline-versus-live-buffer assertion and dependency-list
  corrections; final fast/browser results are the post-fix runs.
- `npm audit --json` returned nonzero for three **unchanged baseline** packages:
  Ajv 8.17.1 (`$data` feature, not enabled), source-map-js 1.2.1 and Vite 8.3.0
  (dev/build surfaces, not the shipped static host). No new CodeMirror package
  was implicated. No broad dependency upgrade or speculative issue was bundled.
- A few source-discovery commands referenced absent filenames or the wrong
  remote namespace, and one exact edit did not match formatted source. These
  were recovered with scoped reads and the runner's pinned transport; no
  permission, publication or test fallback was used.

Stable working logs are `/var/tmp/editor-final-web-fast.log`,
`/var/tmp/editor-final-*.spec.ts.log`, `/var/tmp/editor-final-go.log`,
`/var/tmp/editor-api-tests.log`, `/var/tmp/editor-kernel-uids.log`,
`/var/tmp/editor-package-verify.json` and `/var/tmp/editor-vm-*.log`.
The committed evidence and this result stand without those temporary files.

## Decisions for later review

- Dirty transitions use the browser's explicit discard confirmation: cancel,
  use Save, then retry the transition. A custom Save/Discard/Cancel dialog could
  reduce steps, but was not needed for safe first delivery. Declining another
  tab's engine change keeps the current engine until a later clean open.
- File saves confirm directly from the validated document reply in the mounted
  document state. They do not call Redux `hostChanged`: editor contents/versions
  are deliberately absent from snapshots and the host journal, so inventing a
  snapshot event would create a second file-state owner.
- The existing React Router now uses a data router rather than a custom history
  interception shim, so browser back/forward shares dirty-work protection.
- The VM's static pre-provisioned fixture uses a dedicated ext4 home disk and
  real native quota limits, not a bypass of the broker's current guard. This is
  test setup only, not an installation or deployment decision.

## Not claimed

No live-server/provider validation, real-user data, filesystem-wide native-writer
exclusion, SELinux save support, Monaco implementation, production readiness gate,
push or deployment. Phase 2 reuses this API rather than adding another file path.
