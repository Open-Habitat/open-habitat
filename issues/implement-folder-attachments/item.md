---
created: 2026-10-21
updated: 2026-10-21
type: feature
reporter: jari
status: done
priority: normal
lane: local-files
lane_seq: 1
related: ['@proto-local-files-notice']
collision: [web/composer-attachments]
preparation: ready
size: M
closed: 2026-10-21
---

# Own-computer folder in the attachments menu and Integraatiot

## Description

Implement Jari's choice from proto-local-files-notice (direction 1, "Liitteet"; see issues/proto-local-files-notice/result.md and design-system/prototypes/rounds/2026-10-21-oman-koneen-kansio/).

The composer's attachment action opens a small menu: individual files and the own-computer folder. Folder help, the conditional Brave instruction ("Käytätkö Bravea?") and permission controls appear in an anchored, dismissible panel above the composer only on request (× and Escape, focus returns to the opener). Remove the permanent unavailability banner and the "Salli oman koneen kansio" button outside the interface. Keep the picker-refused guidance (subfolders only) from local-files-picker-refused.

Jari 2026-10-21: the own-computer folder should also appear in Integraatiot (the settings integrations view, web/src/components/Integrations.tsx / app/IntegrationsSettings.tsx): its state there and the ability to share, change or stop sharing. Capability, handle and permission state stay in the browser; no new host data or authority.

Done: production components with stories, phone and desktop, light/dark; tests per TESTING.md; KOKEILTAVAA.md entry.

## Acceptance Criteria

- [x] Composer attachment choices open dismissible folder guidance with keyboard focus restoration and single-file fallback.
- [x] Integraatiot shares the existing browser-local folder state and share/change/stop controls; no host authority changes.
- [x] Production stories and desktop/390 px light/dark interaction, accessibility and regression checks pass.
- [x] Finnish test-server trial instructions are in KOKEILTAVAA.md; evidence and review decisions are in result.md.
