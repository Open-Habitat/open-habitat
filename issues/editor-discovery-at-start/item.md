---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: editor
lane_seq: 2
collision: [internal/gateway/editor]
closed: 2026-10-20
---

# Editor appears only after the person's daemon restarts

_Source: chat:ville-test-2026-10-20_

## Description

On the test server editor.json was installed 2026-10-20 05:44 UTC, but Jari's daemon had started 2026-10-19 12:58, so no Editori button appeared (the daemon reads /opt/open-habitat/editor.json only at start; IMAP's integrations.json behaves the same). Read the installation's editor (and integrations) configuration when needed, or watch it, so installing code-server makes the editor available without restarting every user daemon; the browser also caches availability per session, so it should pick up the change on reload at the latest.

## Acceptance Criteria

- [x] An already-running daemon discovers newly installed editor and integration tools on demand without restart.
- [x] Each new observation retains operator-file and executable trust validation; rejected or removed configuration becomes unavailable.
- [x] A full browser reload rechecks editor availability; status reads never start code-server.
