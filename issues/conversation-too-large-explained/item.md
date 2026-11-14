---
created: 2026-11-07
updated: 2026-11-14
type: improvement
status: done
priority: normal
provenance: agent
source_ref: taskfleet:01m6tynajccbp9qm5prefqy6jk/followup:history-too-large
originating_run: 01m6tynajccbp9qm5prefqy6jk
originating_run_kind: spinoff
lane: history-limits
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Explain a conversation over the 512 MiB native bound to the person

## Description

A native Pi session over 512 MiB (`maxHistoryFile`, `internal/daemon/history_linux.go`) is discovered with history state `unavailable` (`readNativeHeader`). The browser then shows only the generic "History could not be checked" / "Historiaa ei voitu tarkistaa" mark (`web/src/components/ReturnView.tsx`), the history read answers 503 `native_source_unavailable`, and continue, naming and archive refuse with `control_uncertain`/`unproven`. Nothing tells the person why or what to do.

Why the bound stays: Pi itself loads the whole session file into one string, and V8's string limit is about 512 MiB, so Pi could not continue a larger file either. After `large-session-locked` every daemon path streams the file, so 512 MiB is the only remaining bound.

Real-world reach: Kaisa's main conversation on Birch grew to 35 MiB in one week of normal use with images (7.11.2026). At that rate a single long conversation reaches 512 MiB in roughly three to four months. The issue `large-session-locked` asks that hitting any remaining bound be "explained to the person with what to do, never a bare error".

Direction: a distinct history state (for example `too_large` in `contracts/v1/snapshot.schema.json`'s agent `history` enum) set by discovery when the size exceeds the bound, and browser text in both languages saying the conversation has grown too large to open or continue, that its file is kept untouched, and that a new conversation (optionally seeded from a recap) is the way on. Possibly warn earlier, e.g. from 400 MiB, while the conversation still works.
