# Verification

Final implementation: `5c5d5d87c76ffdda723d6ac2afa81812c302a640` (tree `ab76152c2dc346172e7bdef606d13dd3d4c4371a`), following initial implementation `515cdbafbe7c025ae86ee4357aa6cb4e1f25ac57`. No host upgrade, authority change, real session inspection, or shared server/service restart. All native probes use synthetic homes and unique private sockets.

## Maintained remote execution

The baseline/initial-implementation rows below precede the review correction; they are not substituted for the final changed-source runs recorded below.

All Go/build/contract work used the ordinary maintained Alder dispatchers, `umask 077`, and `TMPDIR=/var/tmp`. The runner prepared its native Pi SDK and Python dependencies. These are Linux ARM64 compatibility results, not native amd64 release or distinct-UID certification.

| Check | Immutable job | Outcome |
| --- | --- | --- |
| Inherited baseline: `go test -race -count=1 ./internal/daemon -run 'TestTerminal' -v` | `5cc3eecd41058c0007687357497fe85b6b7fadaa5716754e9acfd71d090cc06c` | PASS, clean `16b09a0b15bf8589a783fa78d5723179629da38b`; includes both creation cases |
| Clean implementation rerun: `go test -race -count=1 ./internal/daemon -run 'TestTerminal' -v` | `f6976b2eef457bcfe05fad498a3363245963847a9ee7323eb511054778f6fa23` | PASS on committed `515cdbaf`, actual tmux 3.4; all nine applicable terminal tests pass, distinct-UID prerequisite skip unchanged |
| Compatibility plus callers: `go test -race -count=1 ./internal/daemon -run 'TestTerminal\|TestWorkspace' -v` | `51fd51f33eeca2f7622226c587960586c6c2e70d1457f4635d760638a2d44a85` | PASS, actual **tmux 3.4** logged by `TestTerminalInventoryFormat`; all terminal and workspace tests passed apart from the existing distinct-UID prerequisite skip |
| `./scripts/test-focused.sh --area contracts` | `1b2353287212c0afe844b187967932673c0913db2bd88b5585ad87c63fcb2425` | PASS: generated files clean before/after generation; 56 schemas, 56 fixtures, 37 scenarios, 17 negative checks |

The latter two jobs captured tracked dirty final implementation bytes on base `16b09a0b15bf8589a783fa78d5723179629da38b`, subsequently committed as `515cdbaf`. Their respective immutable snapshot hashes are `2fca95b5bc650a45969287359019199ffeaa6d91b1d86184802df1ce57b6b7d6` and `6099dfd466cebac5bb27028423b79e8132626d42a06ee9e7d65cd4fa649f430c`. New regressions are in the existing tracked test file, so no untracked test inputs were omitted.

A private **tmux 3.6** CLI probe on Alder also passed normal, space-bearing, UTF-8 and literal backslash037 fields, blanking actual tab/newline/U+001F fields before row assembly while retaining safe identities. Final local synthetic evidence: `/var/tmp/tmux36-final-v4usj20b/probe.json`. It also compared the whole-row and per-field variants on identical control-bearing input, independently confirming review finding F1 and its correction. This is native formatter evidence, not a locally compiled Go run.

## Final changed-source validation

After the review correction, both maintained commands were rerun against implementation commit `5c5d5d87c76ffdda723d6ac2afa81812c302a640`:

- `go test -race -count=1 ./internal/daemon -run 'TestTerminal|TestWorkspace' -v`: **PASS**, immutable job `92387109e9851e6580dfba88c98a9592f6f6bcc5e47d7476aa90f48999e070e2`, snapshot `45d8758ee52944f0941726e532380e92a8d84e1c2bb7b5348d228e1607ed7247`. Actual **tmux 3.4** logged; ten applicable terminal tests, including the new actual-control-argv allocation regression, and all selected workspace callers passed. Existing distinct-UID prerequisite skip unchanged.
- `./scripts/test-focused.sh --area contracts`: **PASS**, immutable job `9f6780168f76fd2643ca5587f3c06ee5e5905e3dfacd124b9e73d1dc0a8bba49`, snapshot `84066d5e0967479cec23ca7281c284c7305b31cc6d64ac96ab2d686b8092eb4c`. Generated-byte checks and host contracts passed. Fetched evidence: `/var/tmp/oh-browser-va1guajg`.

The code/tests were committed and captured; issue acceptance metadata was dirty, so both final receipts correctly report `source_clean: false`. No clean-gate receipt or untracked source-input coverage is claimed. The untracked result document was not a runnable test input.

## Regression coverage and limits

The native format regression exercises real tmux option values (which preserve control bytes even when rename-window itself quotes names). The inventory regression checks literal backslash-octal window names, sibling-prefix paths, delimiter-like paths, tab paths and newline/forged-row paths. Existing shell tests also verify native product-pane identification and rejection of another workspace ID; that deletion-blocker caller now uses the same framing.

Control-bearing native fields are deliberately blanked before formatting, not decoded or normalized into identities. Existing callers reject blank identity fields; unsafe display fields no longer hide a valid live shell or let new-shell allocation reuse its number. Ordinary names, spaces, Unicode and literal escape-like text remain data. Taskfleet viewing remains read-only.

The existing `TestTerminalDistinctUIDs` skip requires the separate disposable multi-UID fixture. No claim of new distinct-UID or installed-systemd evidence is made. Complete Go/browser/lab verification and publication remain the conductor's post-merge work; no full gate was run here.

## Failed attempts (not passing evidence)

The first changed-source focused job `8e8684e0019760376ea31d8deb315d67ddad7144ab467b54432cc8daeb03035f` and first historical-cause reproduction job `eb0ff9e3d8266aa97d3756c6d9259f9a50de19dcf59b96bc5122b4a92ec8fe57` failed compilation: the workspace deletion pane-identification caller still referenced removed `sep`/`terminalFields`. That missed caller was migrated before the passing compatibility/caller run above. Neither failed job exercised its requested assertions. Capped receipts/logs remain under `/home/maintainer/.local/state/hb-exec/results/<job>-*/`.

## Independent diagnosis of both creation failures

Controlled historical-cause job `8658c7ae21b6dd996f3433a8fff7a89ae0ab3e28d5abe1c8664b79f3df714fd6` ran both original assertions unchanged with two deliberate source mutations: restore raw U+001F splitting for shell inventory, and remove the inherited fixture's bus accept/close loop. This is expected-red diagnostic evidence, not the deliverable or a passing validation. The source was restored after capture, before commit.

- `TestTerminalNewShellFindsInstalledToolWithOldServerPath`: the second shell fails immediately with allowlisted **duplicate session** stderr. An empty misparsed inventory causes allocation to reuse shell number 1. This is the inventory defect, not PATH installation or foreground-server support.
- `TestTerminalLingeringStartsServerAsUserService`: the native creation command reaches its four-second context deadline with empty stderr when the synthetic listening bus never accepts/authenticates. The systemd-enabled tmux build attempts user-bus pane scoping. The inherited `f87946460b42970c35ef2baef4d668bd625ac362` fix rejects incidental connections promptly instead; retaining it passes the same assertion in the clean baseline and the final compatibility/caller run. This is an independently reproduced synthetic fixture defect, not evidence to change the product's user-service authority.

The diagnostic mutation captured base `16b09a0b15bf8589a783fa78d5723179629da38b` with intentionally dirty source; immutable snapshot `154a9bac0e5cdebfd8e007fca0db4de9eb5e3ca3c2a5c1d5afda47cc0bd2a581` identifies those diagnostic bytes. No timing assertion, skip or timeout was relaxed. Both creation cases pass on the restored implementation.

## Independent review

Focused `/llm-review`: finder `claude-fable-5-1`, verifier `gpt-6-astra`, routine rigor with mandatory identity-boundary verification. The finder identified F1: whole-row rejection hid live shells when a display field contained a control byte. Local native comparison confirmed it. Assessment: CONFIRMED / OCCASIONAL / IMPROVES / MINOR / HIGH → FIX. Commit `5c5d5d87` applies per-field blanking and adds an actual tab-bearing argv regression that requires the shell to remain listed and the next shell to get number 2. No follow-up issue was needed.

Verifier `gpt-6-astra` confirmed F1 resolved in the exact final diff and found no identity-manufacturing route in framing or the deletion caller. Its private tmux3.6 probes included actual control argv, malformed UTF-8 plus controls, and literal format-looking/escape-like text; it ran no builds or suites. Host validation then supplied the corrected-source real tmux3.4 race pass above. No unresolved required findings, uncertainty requiring a decision, or follow-up issues remain.

Machine-local artifacts: `history/review-terminal-tmux-compatibility.md`, `history/terminal-review-{finder,verifier}.txt`, `history/terminal-final-diff.patch`, and `history/assessment-terminal-tmux-compatibility.{json,md}`. Review completeness is not inferred from agreement: native evidence and exact caller guards establish behavior.

Optional model-performance corpus logging failed once: `/assess-models` could not SSH to Alder (`Permission denied (publickey,password)`, helper exit 3). Scores are preserved in `history/terminal-model-scores.json`; log `/tmp/pi-processes-mdvrJp/proc_d0fb-stderr.log`. No tooling/SSH configuration was changed and no retry was needed for deliverable safety. The review itself completed successfully; only advisory corpus enrichment is unlogged.

## Final lightweight checks

`python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and `git diff --check` passed. No full gate, complete browser/lab suite, push, or deployment was performed. The conductor owns the one post-merge full-main round and live publication.
