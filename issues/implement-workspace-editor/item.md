---
created: 2026-10-19
updated: 2026-10-19
type: feature
reporter: jari
status: done
priority: high
related: ['@proto-file-viewing-2']
lane: workspace-editor
lane_seq: 1
collision: [internal/gateway/]
preparation: ready
closed: 2026-10-19
---

# Workspace editor beside the conversation (code-server, Rinnakkain)

Implement the workspace editor Jari chose on 2026-10-19: direction **Rinnakkain** of `proto-file-viewing-2` (round `design-system/prototypes/rounds/2026-10-19-editorin-tila/`, result.md incl. "Jari's choice") on the architecture of `research-shell-editor` (§Editor, §Security, slice 3; decision 1 and 3 accepted): code-server per person, started on demand by the daemon on a Unix socket via `systemd-run --user` when lingering is on, idle stop; a separate editor origin (test: `open-habitat-test-code.example.test`) with editor-scoped sessions handed off by the gateway; the editor host sends `frame-ancestors` for the app's origin only; the app embeds it in a frame beside the conversation with a remembered, draggable divider; Ctrl+Alt+K via a small built-in code-server extension posting to the app; file links in messages open `path:line` in the running editor; not offered on phones. Verify the session cookie in Safari and Firefox frames. Fleetrepo provides the editor host and the pinned code-server on the test VM (`fleetrepo@open-habitat-editor-host`).

## Resolution

### 2026-10-19T12:56:55Z · @issuectl

Product side complete: code-server per person behind the daemon, editor origin with hand-off sessions, Rinnakkain layout, file links and Ctrl+Alt+K; verified in Chromium, Firefox and WebKit with a real code-server in the synthetic host. Live use waits for the Fleetrepo editor host (requirements in result.md). Shared-origin residual: dreadfully-breezy-carpenter.
