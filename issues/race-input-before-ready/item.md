---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: open
priority: high
lane: races-conversation
lane_seq: 2
preparation: ready
---

# Input before the conversation view is ready is lost (race group 2)

## Description

Sweep group 2: Enter in a just-opened conversation does nothing; typing during a turn loses focus. The loading and opened view share the elements a person uses; an input the view cannot act on yet is kept or refused visibly.

The analysis, cases and fix are in `issues/load-race-sweep/item.md` (## Sweep analysis, group named above) and `issues/load-race-sweep/orderings.md`.

## Acceptance Criteria

- [ ] Every case the sweep listed for this group passes under its detector (reply delay 250 ms, `--repeat-each 2`); counts before/after in result.md.
- [ ] The mechanism is pinned in Vitest with a controlled order where it is browser state logic.

## Comments

### 2026-11-02T15:09:35Z · @claude

From race-status-merge (2.11.): traced under reply delay 250 ms, these cases listed for group 1 belong here: queued-send :170 (after a reload the person types into the loading view's field, which never wakes a resting Pi, so the wake intent is lost and Pi stays stopped) and queued-send :491. A message sent from the creation view is held, and an uncertain outcome is drawn there as a waiting card, while the opened view draws the uncertain card that gives the text back: the same outcome two ways. browser-conversation specs that sent from the creation view now wait for readyConversation.
