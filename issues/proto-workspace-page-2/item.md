---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-workspace
lane_seq: 2
collision: [design-system/prototypes/rounds/proto-workspace-page-2]
preparation: ready
closed: 2026-10-16
---

# Prototype: the whole workspace page, without context menus

Jari, 2026-10-16 afternoon, after using the implemented workspace page (`implement-workspace-page`, from round `2026-10-16-tyotilasivu` direction 1) on the test server:
- "Vasemmalla ei tarvita repon kohdalla mouse overilla mitään kontekstivalikkoa. Pelkkä + eli agentin lisääminen riittää." (In short: the sidebar's workspace row needs no hover context menu; just the +, which adds an agent conversation.)
- "Sama juttu workspace-kohtaisella etusivulla. Mieluummin ne painikkeet jotenkin muuten siihen näkyviin." (In short: the same on the workspace page; the actions should be visible some other way, not hidden behind a … menu.)
- "Prototyyppaa nyt koko workspace-etusivu." (In short: prototype the whole workspace page now.)

Prototype the **whole workspace page** again, starting from what is live now and from Jari's earlier decisions, which still hold: the Git pill-button in the head that opens the Git layer; + creating a conversation directly with no menu; worktree agents not a group of their own (spinoffs show under their parent, Langassa); and archive with the Hetki alhaalla notice. Three directions on one named axis, for example how the workspace's own actions (copy path, open in GitHub, rename, hide from sidebar, delete) are shown without a context menu, and how the page is organised around open conversations, recaps, waiting states (Odotan …), Valmiit and Arkisto. Keep the sidebar workspace row as name plus + only, in all directions. Consistent with `2026-10-16-spinoffit` and `2026-10-16-prosessilohkot`.

## Acceptance Criteria
- [x] Round verified with check.mjs (light, dark, phone, interactions); result.md per the prototype worker rules.

## Decisions

### 2026-10-16T12:35:19Z · @jari

Jari 2026-10-16: direction 2, Ikonirivi. A conversation may not be archived before its agent is done (also while it waits for a process or a spinoff).
