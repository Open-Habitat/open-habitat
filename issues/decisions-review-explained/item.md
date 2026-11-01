---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
related: ['@decisions-review-31-10']
preparation: ready
lane: decisions-review-explained
lane_seq: 1
closed: 2026-11-01
---

# The 31.10. decisions review, explained in product terms

Jari 1.11.: the decisions review page (`issues/decisions-review-31-10/index.html`) lists 53 highlighted items from 49 issues, but he cannot tell what they are about. He wants a product owner's explanation of everything on it: for each item what it means for the people using Open Habitat, whether it is already shipped, superseded or only proposed, and whether he needs to do anything (decide, try, nothing). Group by what Jari has to do. Mark as settled what he answered 31.10./1.11. (see `issues/decisions-review-31-10/item.md`). Plain Finnish.

## Acceptance Criteria

- [x] All 53 highlighted items explained in Finnish with state, action and source; settled answers are not reopened and benchmark proposals remain discussion-only.
- [x] Self-contained offline `index.html`, grouped Päätä / Kokeile / Ei mitään, with working group filters and search at 390 and 1280 px.
- [x] Offered to conductor conversation `pi:90e52a18-12fa-4f71-bc6a-8c8f1a1ec549`; final view `vo2n3ved3tbo3p4sc2qpqwqx4eo`.

## Tests Run

Chromium: all 53 cards, all four group filters, search including no matches, no horizontal overflow at 390/1280 px, no JavaScript errors. Exact original highlighted-ID coverage and all link targets checked; the pruned launch research has an in-page historical source note. All ten benchmark cards carry the discussion-only warning. `validate-project-view.py` and `git diff --check` passed. No product code or services changed.

## Implementation Notes

19 decisions, 14 trials, 20 no-action items. Deployment labels use KOKEILTAVAA, TODO and commit ancestry against pilot.17, not a fresh deployment audit. The finished-worktree exclusion is explicitly wider than just Taskfleet workers; its unapproved consequence is brought to Jari rather than hidden by the old prototype wording. Local screenshots and validation scratch are under `/var/tmp/decisions-explained/`.

The first view `vbb6aiv3dgbntqabhxyxlmg2bww` preceded correction of a pruned-source link; use the final view above. Offers persisted; this does not prove the person opened them.
