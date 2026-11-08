---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: found by proto-large-content-graceful investigation
source_ref: taskfleet:01m6y4rgvm21vzj44k9wgv3kvq/finding:session-over-512mib
originating_run: 01m6y4rgvm21vzj44k9wgv3kvq
originating_run_kind: spinoff
---

# Conversation over 512 MiB can no longer be read, archived or resumed

## Description

A Pi session file over 512 MiB (`maxHistoryFile`, `internal/daemon/history_linux.go:28`) makes its conversation `unavailable`: history, recap, notices, archive (`close_linux.go:25`) and rewind (`rewind_linux.go:197`) refuse it, and once Pi stops (idle stop, daemon restart, upgrade) resume answers `unproven` (`continuation_linux.go:88`). The conversation is then stuck for good, with no way for the person to read, archive or continue it.

The product's own limits reach this. Pi writes every prompt image into the session as base64 (up to ~4.5 MB each after its resize), and the session file only grows (compaction appends). Four maximal sends (100 MiB of attachments ≈ 133 MiB each), about six messages like Jari's 8.11. twenty-screenshot one (80 MB), or ~115 images opened by the agent cross the line. Same class as the 35 MiB (7.11.) and 64 MiB-record (8.11., `recheck-button-unexplained`) incidents, one step further.

Found while investigating `proto-large-content-graceful` (result.md, step 1 table). Directions to consider: read from the tail instead of refusing the whole file (the whole-file readers already stream one record at a time; the bound is a guard, not a necessity); refuse at admission a send that would cross the line, with its reason; warn as the line approaches. Not reproduced on a real 512 MiB file; the path is clear from the code.
