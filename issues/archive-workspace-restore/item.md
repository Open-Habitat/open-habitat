---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 6
---

# Archiving a workspace is slow, and an archived workspace cannot be found or restored

Jari on the test server, 2026-10-16 ~18:40 local, archiving his test workspace (a plain directory) from the sidebar: "Tämä toimii." But both the archive button and the confirm button in its popup respond very slowly. And there is no place to find the archived workspace again or restore it, nor any hint of where it went. He also asked whether archiving only hides it or deletes the whole directory.

Facts: archiving is the daemon's `visibility` action with `hidden: true` (`internal/daemon/workspace_manage_linux.go`); the directory and native histories stay untouched. A "Palauta näkyviin" list exists in `web/src/app/WorkspaceManagement.tsx` but is no longer rendered anywhere reachable. Deletion is a separate, unimplemented design (`recoverable-workspace-deletion`).

Do: (1) find the live cause of the slowness from evidence (request timing on the test server's logs/API for Jari's mapped user; no conversation content) and fix it; the popup closes and the workspace leaves the list at once. (2) Give archived workspaces a findable home with restore: best judgement following the sidebar's Huomio ensin pattern (completed items collapsed), e.g. a collapsed "Arkistoidut" group at the end of the sidebar and/or home page, each with "Palauta". Record the choice under "Decisions for later review" in result.md. (3) The confirm text says plainly that archiving hides the workspace and keeps its files.

## Acceptance Criteria
- [ ] Live cause of the slowness named in result.md with evidence; archive feels immediate (browser test).
- [ ] Archived workspaces are listed somewhere findable and can be restored (browser test, paired screenshots desktop/phone).
- [ ] Confirm text says files are kept.
