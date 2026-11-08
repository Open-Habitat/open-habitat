---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: done
priority: normal
lane: unlaned
collision: [web/src/components/ExperimentalFeatures.tsx]
preparation: ready
closed: 2026-11-08
---

# Graduate Markdown preview, worker's work on its row, and Raise/Not now to default features

## Description

Jari 8.11.2026: the first three cards in Settings › Kokeelliset ominaisuudet
become ordinary features, on for everyone with no switch:

1. `markdown-block-preview` — *Markdown-lohkon esikatselu*
2. `worker-row-sentence` — *Workerin työ rivillä*
3. `raise-to-your-turn` — *Nosta ja Ei nyt*

(order of `featureIds` in `web/src/components/ExperimentalFeatures.tsx`).
Remove their cards, catalog entries and `useExperimentalFeature` gates so the
on-path is the only path; delete the off-path code and its tests rather than
leaving dead branches; drop a stored preference for these ids harmlessly.
Update specs that turned the feature on, the settings search index, explain
mode texts and the agent UI reference (`open-habitat-ui`) where they describe
these as experimental. Other experimental features stay as they are.

## Acceptance Criteria

- [x] The three features work with no setting for a fresh account; their
      cards are gone from Kokeelliset ominaisuudet.
- [x] No gate or off-path code for the three ids remains.
- [x] Touched specs green; `KOKEILTAVAA.md` line.
