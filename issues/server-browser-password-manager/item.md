---
created: 2026-11-22
updated: 2026-11-22
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-password-manager
lane: server-browser-pw
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Research: a password manager extension (Bitwarden) in the server browser that the agent cannot reach

## Description

Jari (22.11.2026): he wants the Bitwarden extension in the server browser so
he can fill passwords himself while he controls it, but the agent must not
reach the extension's contents. Research what is possible: our browser host
runs Chrome with --remote-debugging-pipe (the agent reaches the browser only
through the host's commands), the agent runs as the same Unix user, and the
accepted clipboard security level is "hygiene, not isolation". Next action:
a research report with a recommended design; no product change yet.

## Acceptance Criteria

- [x] Sourced report in result.md distinguishes vault, filled credential and session protection, verifies the actual CDP access path, and proposes follow-ups without changing product code.
