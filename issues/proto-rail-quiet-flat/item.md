---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
lane: rail-quiet-all-flat
lane_seq: 1
related: ['@rail-quiet-all-flat']
preparation: pending
closed: 2026-11-01
closed_by: conductor
---

# Prototype: rail with a flat Hiljaiset listing every conversation

Jari 1.11.: prototype the rail he described before anything is built
(`rail-quiet-all-flat` holds the description and the defaults that fill
his gaps). Three sections, Sinun vuorosi · Käynnissä · Hiljaiset, where
Hiljaiset lists every other conversation newest first as one flat list
without workspace header rows. Show it with realistic amounts: a few
conversations, and a person with many workspaces and dozens of
conversations, so the length of "all of them" can be judged. Baseline is
main now (with Viimeisimmät); the main direction is Jari's; add at most
one or two variants only where his description leaves a real choice
(for example how a row says its workspace without icons). State graph,
clickable rail in production context, desktop and phone, light and dark,
icons on and off, Finnish texts.

## Resolution

### 2026-11-01T14:15:50Z · @conductor

Jari 1.11.: icons on is the target default; Hiljaiset collapsible and sortable, riffed in proto-rail-quiet-flat-r2.
