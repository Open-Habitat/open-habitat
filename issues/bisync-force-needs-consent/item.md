---
created: 2026-11-14
updated: 2026-11-16
type: improvement
status: open
priority: normal
preparation: pending
lane: sync-consent
lane_seq: 1
---

# Cloud sync's all-files-changed stop waits for the person's consent before a forced pass

## Description

When two-way cloud sync stops because every file in a folder appears changed
(rclone bisync's all-files-changed abort), Habitat today checks with a dry
run that it is not a mass deletion and then continues automatically with a
forced pass. The forced pass also bypasses the large-deletion guard, and the
dry run and the forced run are separate, so a mass deletion arriving between
them can reach the other side (`bisync-all-files-changed-abort`,
`internal/daemon/integrations/passes_linux.go`, `syncLoop`,
`passObserver.forced`). Not observed; a known gap.

## Direction (Jari 14.11.2026, from `decisions-review-after-31-10` item 1)

In normal use the sync stops and does not continue by itself. The person is
told it stopped and why, and can explicitly ask for one forced pass (a
separate consent, e.g. *Jatka silti* in the account's card, or asking the
agent), seeing what the forced pass would do (counts of changes and
deletions from the dry run) before confirming. Awaiting Jari's confirmation
of the concrete shape (`preparation: pending`).

## Decisions

### 2026-11-14T11:42:19Z · @jari

Jari 14.11.2026: direction accepted; next action a prototype round of the stop notice and the consent to one forced pass.

### 2026-11-14T12:54:31Z · @jari

Jari 14.11.2026 on round 1: a person will not find this in Settings. The stop and the consent belong where the agent started the work and caused the change (the conversation), not the integrations card. Round 2 explores that.

### 2026-11-16T05:50:34Z · @jari

Jari 16.11.2026 on round 2: (1) Direction A Kortti. (2) No separate agent dialog: the agent may bring Habitat's card into the conversation with a command (proposal: `open-habitat agent sync request-consent`) and explain in its own words, but consent is only ever the card's button, bound to the count; a plain 'yes' to the agent is never consent. Same pattern is a candidate for worker-asks-parent. (3) Bell and Settings card are enough when no conversation caused the stop. (5) The 'too many deletions' stop gets the same card and consent. (4) Still open: residual seconds between the count check and the forced pass (recommendation: a no-delete pass when the count had no deletions); to be explained in round 3. Next action: prototype round 3 of the chosen card, since the design is still being worked out.
