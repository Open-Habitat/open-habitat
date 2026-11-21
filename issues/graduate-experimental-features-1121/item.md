---
created: 2026-11-21
updated: 2026-11-21
type: improvement
reporter: jari
status: open
priority: normal
lane: experimental-graduation
lane_seq: 1
preparation: ready
---

# Graduate twelve experimental features to ordinary features

## Goal

Jari 21.11.2026 went through the experimental features and decided that these become ordinary features, on for everyone, with their switch removed from Settings › Kokeelliset ominaisuudet: `terminal-open-urls`, `storage-breakdown`, `rail-background-door`, `scheduled-wake`, `explain-mode`, `turn-changes`, `conversation-context-view`, `shares-page`, `agent-resources-view`, `atlassian-connect`, `trello-connect`, `named-workers`.

Stay experimental: `rewind-conversation`, `remote-browser`, `multiplayer`. `terminal-copy-on-select` stays as it is until it becomes an ordinary terminal setting, off by default (`terminal-settings-page`).

## Decisions

- Jari 21.11.2026: the list above. Explain mode graduates, and he wants feedback from it (`explain-mode-feedback`). The name "Jaetut" needs a better title (decided separately).
