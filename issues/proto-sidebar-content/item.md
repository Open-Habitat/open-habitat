---
created: 2026-10-25
updated: 2026-10-25
type: improvement
reporter: jari
status: open
priority: normal
lane: proto-sidebar
lane_seq: 1
preparation: ready
---

# Prototype what the sidebar should hold instead of the workspace list

## Description

Jari, 2026-10-25: "Haluaisin nyt tosta sivupalkista prototyyppejä jossa on
mietittynä ja ideoituna siihen erilaisia ideoita mitä siinä itse asiassa voisi
olla. Toi repolista ei ole tollaisena paras. Ehkä aktiiviset agentit tms tai
jotakin muuta." (Prototype the sidebar with considered, varied ideas of what
it should actually hold. The repository list as it is now is not the best.
Perhaps active agents, or something else.)

Today the sidebar lists the workspaces found under `~/src` with their
conversations (`docs/product.md`, "Työhön palaaminen ja navigointi";
`web/src/components/Navigation.tsx`). The start page is the return view for
running and recent conversations.

## Goal

A divergent prototype round: several genuinely different ideas of what the
sidebar is for (for example active and waiting agents first, attention
needed, recent conversations across workspaces, worktree agents and their
parents, pinned work, or a mix), each worked out enough to judge, including
how one still reaches a workspace that is not active, desktop and phone, and
how it relates to the start page. Present them to Jari for a verdict before
any production change.

## Acceptance Criteria

- [ ] Prototype variants with notes, and Jari's verdict recorded.

## Decisions

### 2026-10-25T18:04:11Z · @jari

Jari 2026-10-25 on round 1: 'Nyt' is the direction (clearest). The Käynnissä block also includes agents waiting on background work (processes/workers). Agents need not be listed under workspaces any more; a workspace's agents are reached through that workspace's front page. Next: a riff round on how the workspaces are shown under Nyt.
