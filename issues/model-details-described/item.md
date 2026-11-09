---
created: 2026-11-09
updated: 2026-11-09
type: improvement
reporter: jari
status: open
priority: normal
lane: model-details-proto
lane_seq: 2
preparation: ready
---

# Model details as information, with a short description of each model and of the thinking level

## Description

Jari 9.11.2026 chose direction **B Tietona** of `proto-model-details-not-picker`
round 1 (its round and result.md are the spec): the top bar's model popover
is information, not a picker. Added (Kaisa via Jari): every model shown
gets a short plain description of what it is good for (a bare "Opus 5.5"
tells her nothing), and the thinking level gets an explanation of what it
means and what a higher level costs (time, quota) and buys.

Descriptions are product copy in both catalogs for the model families the
host knows (Claude Fable, Opus, Sonnet, Haiku; OpenAI GPT-6 Astra and the
others in `web/src/components/modelPresentation`), ordered by capability; an
unknown model shows no description rather than a guess. Use the same
descriptions where models are chosen (Settings › AI, the composer's model
control) so they read the same everywhere.

## Acceptance Criteria

- [ ] Popover reads as information (no button-like rows), each known model with a one-line description, the thinking level explained; fi and en; 1440 and 390, light and dark.
- [ ] The same descriptions appear where models are chosen; Explain card updated; touched specs green.
