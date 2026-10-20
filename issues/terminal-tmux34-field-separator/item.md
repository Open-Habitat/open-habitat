---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: fleetrepo-execution-acceptance-agent
status: untriaged
priority: normal
provenance: other
provenance_detail: Observed directly in real offloaded Go tests and private-socket tmux version comparison
source_ref: fleetrepo:orx-background-runner:34cc4021:tmux34-native-format
---

# tmux 3.4 escapes terminal field separators and real sessions disappear from inventory

## Description

Observed while executing the unmodified full Go race suite in the shared Linux ARM64 guest, against OH commit `8154670f59909b3b71d458e824f661ac0a42f421`:

```
go test -race -count=1 ./...
```

Durable job: `34cc40210b516c84a7d52ae8d196428381e4871013f41650d85b26ed7d3bfb20` (test-exit, exit 1). All packages except `internal/daemon` passed, including native Pi/credential prerequisites and provision tests after the execution environment was repaired. Five terminal tests failed:

- TestTerminalShellRunsAsPersonInWorkspaceAndSurvivesBrowser: after browser disconnect, inventory has `Shells:[]`.
- TestTerminalBusyShellAndClose: busy inventory has `Shells:[]`.
- TestTerminalTaskfleetAttachIsReadOnly: `taskfleet windows []`.
- TestTerminalLingeringStartsServerAsUserService: no ready message, closed 4503/create_failed.
- TestTerminalNewShellFindsInstalledToolWithOldServerPath: no ready message, closed 4503/create_failed.

A controlled private-socket CLI probe (separate socket/server, no shared sessions changed) confirms a concrete format mismatch in the first three inventory failures. Guest Ubuntu's distro tmux is **3.4**; Alder's maintained tmux is **3.6**. Running `list-sessions -F` with the literal format `#{session_name}<U+001F>#{window_name}<U+001F>#{pane_current_command}` returns:

- tmux 3.4: Python repr `'probe\\037bash\\037bash\n'` — the delimiters are literal four-character octal escape text.
- tmux 3.6: Python repr `'probe\x1ftmux\x1ftmux\n'` — actual U+001F separators.
- A tab-delimited 3.4 probe returned real tabs, confirming this is formatting behavior rather than a missing server/session.

`internal/daemon/terminal_linux.go` defines `const sep = "\x1f"` and splits native `list-sessions` / `list-windows` output on that raw separator (around lines 310, 340–365 and 395–421). On 3.4 it sees one field and silently skips the real row. This is a supported-distribution native-component compatibility issue, not proof of an ARM CPU defect. The two foreground-server failures may share a version dependency, but their exact cause was not independently established by this delimiter probe.

Expected: either correctly and safely handle the native format on supported distro tmux versions, or declare/enforce an actual minimum version during installation/preflight rather than silently claiming empty inventory. Preserve field-boundary/identity safety for adversarial window names and paths; blindly decoding delimiter-like text must not create another-workspace rows. Do not weaken the assertions or label this red suite green. Related existing UI report: @shell-panel-open-direct, but this report has a distinct reproduced native formatting cause.

Full capped logs and artifacts remain available through the durable job. Local fetched evidence is `/home/maintainer/.local/state/hb-exec/results/34cc40210b516c84a7d52ae8d196428381e4871013f41650d85b26ed7d3bfb20-046e75b05b6e4f34a06af41f802af997`. No application code or production tmux sessions were changed for this investigation.
