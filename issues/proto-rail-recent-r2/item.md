---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: open
priority: normal
lane: proto-rail-recent-r2
lane_seq: 1
related: ['@rail-recent-five', '@proto-rail-recent']
preparation: ready
---

# Prototype: the Viimeisimmät rail section as implemented, and its open choices

Jari 1.11.: `rail-recent-five` was implemented without a prototype of its final form. `proto-rail-recent` compared three directions and Jari chose *Viisi viimeisintä* in words, adding a configurable count, but the implemented details were never shown to him as a working prototype: the count setting, which conversations are listed (all finished worktree conversations are excluded, also ones he started himself; terminal-run ones are included), the italic row for an older open conversation, the narrow rail without the section, no experimental gate. Prototype the rail as it now is on main (`d2646e25` and later) as the baseline, and 2–3 directions on the axis that the unprototyped choices raise, with state graphs, clickable rails in production context (desktop and phone, light and dark, icons on and off), Finnish texts, and where the count is set. The accepted prototype becomes the specification; the implementation on main follows it afterwards.
