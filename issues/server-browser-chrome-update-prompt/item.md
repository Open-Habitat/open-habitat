---
created: 2026-11-28
updated: 2026-11-28
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:conductor-2711/chrome-update-prompt
lane: server-browser-frame
lane_seq: 2
preparation: ready
---

# Server browser shows Chrome's own update/relaunch prompt after a package upgrade

## Description

Jari 28.11.2026: opening the signed-in server browser on a pilot installation,
the remote Chrome showed its own "update / relaunch" prompt. Google Chrome
comes from Google's apt repository (`internal/host/server_browser_linux.go`,
`google-chrome-stable`) and is upgraded on disk by the system's package
updates while a person's browser keeps running the old version, so Chrome
asks to be relaunched. The person should not have to deal with Chrome's
update prompt: Habitat starts the new version itself at a safe moment (e.g.
when the browser is next opened after being closed, or when it is idle with
nobody driving), keeping the profile and sign-ins, and Chrome's own relaunch
prompt does not appear.
