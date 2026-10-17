---
created: 2026-10-16
updated: 2026-10-17
type: feature
reporter: conductor
status: done
priority: normal
provenance: other
provenance_detail: Follow-up of implement-workspace-trash (backend done; UI waits for Jari's prototype choice)
source_ref: taskfleet:01m53433zdhmcc9q1spepb30gz/follow-up:implement-trash-ui
originating_run: 01m53433zdhmcc9q1spepb30gz
originating_run_kind: spinoff
collision: [web/src/app/, web/src/components/, internal/daemon]
lane: web
closed: 2026-10-17
---

# Workspace Trash UI per Jari's chosen prototype direction

## Description

Build the browser view for workspace deletion and the Trash, following the prototype direction Jari chooses from the 2026-10-17 round.

The backend is done ([implement-workspace-trash](../implement-workspace-trash/item.md), [ADR 0019](../../docs/decisions/adr-0019-workspace-deletion.md)). Until this lands, the trash button in `web/src/components/WorkspaceActions.tsx` stays disabled with its current reason text.

## Spec

- Prototype round: `design-system/prototypes/rounds/2026-10-17-roskakori/` (build with `node build.mjs rounds/2026-10-17-roskakori` in `design-system/prototypes`).
- Directions and open questions: [proto-trash-and-devices result](../proto-trash-and-devices/result.md) — (1) own page, (2) among workspaces, (3) under Storage. Jari picks one; the approved prototype is the spec. His answers to the five questions there (ignored files, fetch before outright delete, "move to Trash anyway", empty Trash) may need small backend changes.

## API (ready)

`POST /api/v1/workspaces`, contract `contracts/v1/workspace-deletion.schema.json`, client `web/src/app/workspaceTrash.ts` (validated replies, typed refusal codes):

- `checkWorkspaceDeletion` (`delete_check`): read-only; `outcome` is `blocked` | `trash` | `permanent`, with `blockers` (each says what to do: `pi_session` with `agent_id`, `process` with `pid`/`comm`, `taskfleet_run` with `run_id`, `linked_worktree`/`locked_worktree` with `path`, `is_linked_worktree`, `contains_linked_worktree`, `mount`, `different_filesystem`, `unknown` with `check`) and `facts` (Git counts, ignored paths, last fetch, conversations, stale worktrees, size).
- `deleteWorkspace(ws, "trash" | "permanent")`: `trashed` with `entry` and `processes_inside`; `deleted`; `partial`; `replaced`; or `blocked` with the check body. `permanent` is refused (`workspace_not_clean`) unless the check said `permanent`, and may come back `trashed` with `kept_reason`.
- `listTrash`, `inspectTrashEntry` (Git facts, size, conversations for one entry), `restoreTrashEntry` (`workspace_exists` when the name is taken; rows say `restore: name_taken`), `deleteTrashEntry(entry, typedName)`.

Delete the host-backed API case `web/tests/lab-workspace-trash.spec.ts` or fold it into the UI journey once the view exercises the same path.

## Acceptance

- Delete, restore and permanent delete work from the UI in the lab; each refusal code and blocker kind has readable Finnish text.
- Paired lab screenshots (desktop and phone, light and dark) in this issue.

## Decisions (Jari, 2026-10-17)

Implement direction **Tallennustilassa** of `design-system/prototypes/rounds/2026-10-17-roskakori/` with the decisions in `issues/proto-trash-and-devices/item.md` (Decisions, roskakori): Trash in Asetukset › Tallennustila with the quota bar; the post-move notice links there; ignored files never block outright deletion; a `git fetch` runs before a permanent delete and a failed fetch sends the workspace to the Trash; no "Siirrä silti roskakoriin" in the clean case; "Tyhjennä roskakori" with confirmation. The fetch and empty-trash need daemon support (extend the `implement-workspace-trash` actions and contract). Enable the workspace page's trash button.
