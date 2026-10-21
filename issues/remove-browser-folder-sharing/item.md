---
created: 2026-10-21
updated: 2026-10-21
type: task
reporter: jari
status: done
priority: normal
lane: local-files
lane_seq: 3
related: ['@shared-folder-not-visible-to-agent', '@integration-dropbox']
collision: [internal/daemon/pi-launch, web/composer-attachments, internal/daemon/host-context]
preparation: ready
size: M
closed: 2026-10-21
---

# Remove browser folder sharing; point to OneDrive/Dropbox for own-computer files

## Description

Jari 2026-10-21 decision after testing: sharing a folder from the person's own computer through the browser (File System Access API, local_files Pi tool, Liitä → Oman koneen kansio, its Integraatiot card, Brave guidance, picker-refused guidance) is removed entirely. Sharing the Downloads folder (or another folder) through OneDrive or Dropbox is the better and simpler route.

Do:
- Remove the whole browser folder-sharing feature end to end: web UI (attachments menu entry, folder panel, Integraatiot card, browser-local state), the local_files Pi tool and its daemon/gateway bridge, contracts and generated code, tests, stories, lab fixtures, and host-context text that tells the agent about local_files. Ordinary single-file attachments stay. No compatibility code (pre-release).
- In the OneDrive and Dropbox integration (its setup / Integraatiot view, wherever the person connects it), add a short mention that through the synced folder the person can share content from their own computer, such as screenshots, and receive attachments meant for their own computer (e.g. from email) by having the agent put them there. Tell the agent the same in its host context, briefly, so it suggests the cloud folder when someone asks it to read or deliver files on their own machine.
- Remove the KOKEILTAVAA.md entries about the own-computer folder and Brave; add one Finnish entry for the new mention.
- Rules that no code shows (e.g. that browser folder access was deliberately removed in favour of cloud sync) go in the nearest AGENTS.md if a later agent would otherwise rebuild it.

## Decisions

### 2026-10-21T17:29:12Z · @jari

Jari 2026-10-21: remove the browser folder-sharing feature completely; own-computer files go through OneDrive/Dropbox, and the cloud integration mentions sharing screenshots and receiving attachments that way.

## Acceptance Criteria

- [x] Browser folder sharing removed through UI, tool, routes, CLI, contracts and fixtures; ordinary attachments verified.
- [x] OneDrive/Dropbox guidance added for people and agents, and Finnish test notes updated.
- [x] Focused web/browser/Go/contracts/packaging checks and final diff review passed.
