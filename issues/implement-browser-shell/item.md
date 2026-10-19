---
created: 2026-10-19
updated: 2026-10-19
type: feature
reporter: jari
status: done
priority: high
related: ['@research-shell-editor']
lane: browser-shell
lane_seq: 1
collision: [internal/gateway/]
preparation: ready
closed: 2026-10-19
---

# Browser shell: Paneeli, tmux-backed PTY in the daemon, WebSocket relay

Implement the browser shell Jari accepted on 2026-10-19: direction **Paneeli** of `proto-browser-shell` (round `design-system/prototypes/rounds/2026-10-19-selainpaate/`, its `issues/proto-browser-shell/result.md` "What every direction shares"), on the architecture of `research-shell-editor` (report §Shell, §Security, §"Suggested first slice" slice 1; decisions accepted in its item.md). Daemon: per-workspace upgrade endpoint, PTY running `tmux new-session -A` against the product's tmux socket under `$XDG_RUNTIME_DIR`, via `systemd-run --user` when lingering is on, otherwise a daemon child with the snapshot saying it does not survive restart; resize; Taskfleet sessions read-only. Gateway: upgrade relay with exact Origin, CSRF proof in the first message, per-session caps, registered so logout/revocation/expiry close it (reuse the registry from `streams-outlive-revocation`). Web: xterm.js panel under the composer with tabs, Ctrl+` toggle, phone key row, paste confirmation for multi-line, "Vie keskusteluun". Contract route in `contracts/v1/`.
