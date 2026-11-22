---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-browser-runtime-always
lane: release-runtime
lane_seq: 9
preparation: ready
closed: 2026-11-22
---

# Server browser runtime (TigerVNC, Google Chrome) is always installed, not best effort

## Description

Jari (22.11.2026): TigerVNC and Google Chrome must always be installed on an
installation, not best effort. Today host apply/upgrade installs Chrome from
Google's apt repository as a best-effort step after entries reopen
(internal/host/server_browser_linux.go), so a host can silently end up without
the server browser (a pilot installation on v0.1.4 had neither).
Next action (approved): make the server browser runtime a guaranteed part of
every installation and visible when it is missing.
