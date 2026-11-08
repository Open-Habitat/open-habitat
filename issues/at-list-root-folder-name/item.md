---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# File list shows the workspace name as the folder of a root-level file

## Description

Jari 8.11.2026, test server: in the composer's file list (typed `@` / file
button, search mode where the name comes first and its folder after), a file
at the repository root, e.g. `AGENTS.md` in `open-habitat`, shows its folder
as the workspace/repository name (*AGENTS.md · open-habitat*). A root file
has no folder; the folder part should show the root itself, `/`, not the
workspace's name (which reads as if there were a subfolder of that name).
Check the tree mode, the preview header and → *Näytä kansiossa* for the same
mistake. Defect fix. `web/src/components/composer/FieldList.tsx` and the
row's folder label.

## Acceptance Criteria

- [ ] A root-level file's folder shows as `/` in search, tree and preview.
- [ ] Unit or browser test for a root file and a nested file.
