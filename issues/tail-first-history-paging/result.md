# Result: tail-first native history and bounded backward paging

Implemented a newest-page history request and `before=<entry_key>` pages that include the boundary entry, return `older_complete`, and explicitly report a missing boundary. Pages remain in native order. The daemon hashes the native file for history/content revision identity, reads records backwards from the selected file, and does not retain a history index. The existing forward `after` route remains temporarily for the current browser views; `conversationPager.ts` is a React-free network/validation/cancellation layer for the next store wave. It reloads the tail rather than joining pages after a lost boundary.

## Verification

- Synthetic 2,500-entry history: 13 backward HTTP pages (200-entry limit, shared boundary overlap), all 2,500 unique keys recovered in order; a subsequent native append left the older-page cursor usable. Missing boundary and inactive native-tree branch are reported rather than joined. Existing forward paging and revision-scoped content tests still pass.
- Synthetic 34 MiB native entry, 35,651,584 bytes of payload: tail request 1.35 s on this worker; 240,597 response bytes. A separate content chunk response was 65,769 bytes, with 3 HTTP requests for the tail, older page and chunk. Inline text is at most 65,536 bytes per entry and 256 KiB across a page; native records are limited to 64 MiB and native files to 512 MiB. These timings include the full-file hash and reverse read, and are not production latency measurements.
- Browser pager unit tests exercise bounded recovery, overlap, missing-boundary reload and cancellation; web typecheck/format/lint and host-contract fixture/negative validation passed. `go test ./internal/daemon ./internal/gateway ./internal/contracts -count=1` passed after installing the pinned test SDK fixture.
- `./scripts/ci-local.sh --clean --json`: pending final committed-tree run.

Click-to-paint was not measured: this slice has no store or UI integration; @recent-conversation-windows owns that measurement. No live Pi session, live server, or real-user history was read. The temporary forward route is removed only when existing browser readers migrate.

## Review and design

This change touches native parsing and a browser/host contract, but does not move identity or command authority. A focused final-diff review is proportionate; no speculative new state/index was added. No accepted design departure was needed.
