---
created: 2026-11-14
updated: 2026-11-14
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
