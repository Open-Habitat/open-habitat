---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m7crr8pp31xgtejmknvckwes/review-finding:history-mode-remnants
review_source: ai-review
originating_run: 01m7crr8pp31xgtejmknvckwes
originating_run_kind: spinoff
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: low
review_target: 53fee283 (product source)
size: S
---

# Remove the obsolete virtual-history mode surface

## Observed problem

At review commit `53fee283`, `web/src/components/Conversation.tsx` still requires `ConversationTimeline.historyMode` and accepts `onHistoryModeChange`. The only implementation of this mode is the optional button at lines 57–77: changing it changes the button's label, not how history is rendered.

All three production callers (`app/HistoryView.tsx`, `app/BrowserConversation.tsx`, `app/PendingConversation.tsx`) pass `"pagedAccessible"` and no change callback. Stories in `ConversationStates.stories.tsx` and `Catalog.stories.tsx` do pass the callback and toggle between two purported modes. `src/test/CatalogPreview.tsx` also supplies `"virtualized"`. Separately, knip reports the installed `@tanstack/react-virtual` dependency in `web/package.json` as unused; a source search confirms there are no imports.

The real history implementation is in HistoryView and its store/pager, not this switch. The leftover interface forces production callers to supply a meaningless mode, and stories present a control for a feature the product does not implement. The unused dependency still has an installation and lockfile footprint.

## Proposed refactor

Remove the no-op mode props/control from ConversationTimeline and update its production callers, stories, fixtures, and the two now-unused history-mode translations. Remove `@tanstack/react-virtual` from the manifest and regenerate the lockfile. Preserve the actual history pager, accessible history rendering, and scrolling behavior. Do not implement virtual scrolling to justify the leftovers.

Size: S (a component interface cleanup, callers/catalog copy, manifest and lockfile). Run web type/build/unit checks and inspect the affected story states; existing history paging/scroll tests must remain intact.

## Assessment

CONFIRMED; recommendation SPIN_OFF; severity low; confidence high. Knip's unused dependency lead was confirmed with source search and by reading the component and its production callers. This is not the separately filed pending-command dead branch.
