---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
lane_seq: 6
collision: [docs/]
preparation: ready
---

# Google integration instructions: enable Sheets, Docs and Slides APIs

_Source: chat_

## Description

Jari 29.10. (from `research-ville-feedback`, item 3): the Google integration instructions must be fixed. On the Northwind pilot Sheets failed with "Sheets API is not enabled for this OAuth project": the operator guide and the administrator's Google setup instructions only covered the OAuth client and the APIs for Drive, Gmail, Calendar and Contacts. The granted `auth/drive` scope already covers Sheets, Docs and Slides; the APIs just need enabling in the Google Cloud project.

## Acceptance Criteria

- [ ] `docs/operations.md` and the in-product administrator Google instructions list every API to enable (Drive, Gmail, Calendar, People, Sheets, Docs, Slides) with direct console links using the project's id where the UI knows it.
- [ ] The personal-data / Google skill text tells agents that `gog sheets|docs|slides` exist and what a "not enabled for this OAuth project" error means (an administrator action, with the link), so an agent says that instead of "no permission".
- [ ] KOKEILTAVAA line.
