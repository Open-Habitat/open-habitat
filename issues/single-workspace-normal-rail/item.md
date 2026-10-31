---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: done
priority: high
lane: single-workspace-normal-rail
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# One workspace: drop the single-workspace view, use the normal rail

## Description

Jari 31.10. evening (seeing Kaisa use it): the special view for a person with only one workspace (`SingleWorkspaceBar`, `SingleWorkspaceBarView`, related parts of `App.tsx`, `WorkspacePage.tsx`, `Navigation.tsx`) does not work and should fold into the normal view: the ordinary rail is there as for everyone. With one workspace the rail needs no workspace list holding a single item and no *Työtilat* button; instead a quiet mention at the bottom such as *Lisää työtiloja* (or the one workspace named in some light way; Jari is not sure which). Not behind a flag: a fix to existing behaviour Jari asked for directly.

## Acceptance Criteria

- [x] A person with one workspace sees the normal layout and rail; no single-workspace bar or view remains in the code.
- [x] The rail shows no one-item workspace list; a way to add workspaces stays one click away; how the single workspace is named is decided and recorded under Decisions for later review, with screenshots (desktop and phone, light and dark, fi and en, DSF 2).
- [x] With two or more workspaces nothing changes; browser specs for one and two workspaces.

## Comments
