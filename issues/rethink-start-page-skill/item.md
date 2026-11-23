---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84cm6yjvpv30zvsak1mh5ex/rethink-start-page-skill
originating_run: 01m84cm6yjvpv30zvsak1mh5ex
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
---

# Rethink the start page skill

## Description

## Description

Jari asked on 23.11.2026 for the start page skill
(`internal/daemon/start-page-skill/SKILL.md`) to be rethought with
`/rethink-instructions`, in parallel with the other agent instructions the
host ships. The skill is the instruction a person's Pi agent gets when asked to
create or refresh a repository's Aloita tästä start page
(`.agents/start-page.md`).

The file had grown by accretion: each feature of the page (the guide,
`guide: none`, `start: immediate`, the placeholder, the goal's own skill,
conversation names) added sentences where they fitted at the time, so the
format, the host's behaviour and the way of working were interleaved, some
facts were stated two or three times, and the reason for the few real limits
(propose first, never commit) was not written down.

## Acceptance

- The skill says what the page is for, who decides its content and why, and
  what the agent cannot know about how the host shows and prepares goals.
- The exact interface (file format, the goal's own skill) stays exact.
- Only this file changes; fact-checking is a separate pass.
- `result.md` gives the account: what the original protected, what changed and
  where Jari's knowledge is needed.
