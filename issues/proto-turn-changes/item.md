---
created: 2026-11-10
updated: 2026-11-10
type: task
reporter: jari
status: open
priority: normal
related: ['@extend-tool-views']
lane: turn-changes-proto
lane_seq: 1
preparation: pending
---

# Design and prototype: what the agent changed in a turn

## Description

Jari 10.11.2026 wanted one prototype cycle as a demo for someone following
the development. Conductor's pick, from the accepted design work
`extend-tool-views` (L9, richer diffs): when an agent turn has changed files,
the person should see at a glance **what the agent changed**, without reading
every tool card.

Today each `edit`/`write` shows its own diff inside the turn's tool cards
(`web/src/components/FileToolCard.tsx`), and a finished stage collapses them.
A turn that touched eight files leaves the person to piece the result
together, or open the editor.

Prototype round per `AGENTS-WORKFLOW.md`, one view (the end of a finished
agent turn in a conversation): today's state first, then three directions,
for example a compact "Muutokset" summary under the reply (files with +/-
counts, one click opens that file's diff); a review panel beside the
conversation stepping through files like a pull request; a per-file
timeline of the turn's edits. Cover one small edit, a turn touching many
files, a new file and a deleted file, a file the agent edited several times,
a binary file, a turn still running, and opening the file in the editor at
the changed line. 1440 and 390, light and dark, reduced motion, Finnish and
English. Record the host facts: what the daemon and contract already carry
(tool events, `edit` diffs, git status per workspace) and what a
production version would need, including whether the turn's diff comes from
the tool calls or from git.

## Acceptance Criteria

- [x] Prototype round 1 with directions, host facts and questions for Jari.
- [x] Prototype round 2 combining Jari's round-1 choices (collapsed Yhteenveto, timeline behind a button), with host facts and questions for Jari.

## Decisions

### 2026-11-10T13:04:46Z · @jari

Jari 10.11., round 1: Yhteenveto (1) is the best; take from Katselmointi (2) that it is collapsed by default; put Aikajana (3)'s timeline behind an optional button. Round 2 combines these.
