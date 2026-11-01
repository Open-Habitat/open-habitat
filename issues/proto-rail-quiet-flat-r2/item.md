---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
lane: rail-quiet-all-flat
lane_seq: 2
related: ['@proto-rail-quiet-flat']
preparation: pending
closed: 2026-11-01
closed_by: conductor
---

# Prototype round 2: collapsible, sortable Hiljaiset with workspace icons

Jari 1.11. on `proto-rail-quiet-flat`:

- **Workspace icons on is the target default.** Design the rail on top of
  icons on; the no-icons case is secondary (so round 1's name-vs-initials
  question is not the point).
- **Hiljaiset must be collapsible** (the section can be folded away).
- **Hiljaiset must be sortable** so a person can handle about **5
  repositories and some twenty agents/conversations** comfortably.

Riff on these: 2–3 directions on one axis (for example what the sort
choices are and where they sit: newest first, by workspace, by name; how
the fold looks and whether it remembers per device or per account; whether
sorting by workspace brings back light grouping), with realistic data of
5 workspaces and ~20 conversations, plus the larger set for comparison.
Baseline is round 1's direction 1 with icons on. State graph where it adds
something, clickable rail in production context, desktop and phone, light
and dark, Finnish texts. Say which host facts each direction needs (does
the fold or sort need a stored preference, and where).

Related: making workspace icons the default (they are an experimental
feature today) is its own decision; this round assumes it.

## Resolution

### 2026-11-01T15:13:45Z · @conductor

Jari 1.11.: answered; continued in the issues named in the conductor's commit.
