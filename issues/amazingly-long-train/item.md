---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: untriaged
priority: low
provenance: agent
source_ref: r42-send-rejected
---

# TestEditorFilesRoundTripAndConflict flaked once in a full internal/daemon run

## Description

Observed 31.10. by the send-rejected-after-delivery worker on Birch: one failure in a full ./internal/daemon run after a rebase; passed alone 3x and in a full rerun. Unrelated to that change. Watch for recurrence before investing; a second sighting makes it worth a fix.
