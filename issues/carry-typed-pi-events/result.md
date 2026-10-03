# Typed Pi events: initial history slice

This run is **not the completed issue**. Native history now projects ordered text, redacted-thinking markers, image type placeholders, and tool-call identities into bounded typed blocks, with the model, stop reason and tool-result association. The same projection travels in `history.entry` journal frames, and the browser renders the typed blocks from either source. The native session remains authoritative; paging, native keys and the existing full-text content endpoint remain in place. Unrecognized block payloads and unknown entry payloads are no longer echoed to the browser.

## Privacy selection

The projection explicitly excludes thinking signatures, provider diagnostics and response IDs, raw provider errors, deferred data, arbitrary extension `details` and `data`, tool arguments and image base64. These values may contain credentials, and a generic redact-by-key filter cannot safely establish that they are displayable. Redacted thinking does not include its text. Hidden custom messages are omitted. The `unknown` marker names no unchecked payload. Visible extension message content, image data and safe argument access need a considered bounded content-read design before this can be called complete. The old flattened full-text content endpoint still exists and must be replaced along with its browser fallback before this issue can close.

## Evidence and limits

Synthetic Go projection tests exercise content order, tool identity, redaction, unknown and hidden content. Browser component tests exercise ordered rendering and ensure the flattened string does not leak through the typed assistant view. `validate_contracts.py` passed. `test-web-fast.sh` passed after adding the history schema to the event/snapshot validators. Full clean gate outcome is recorded below after running it.

Still needed: replace flattened history/content with bounded per-block content reads (especially image data, large summaries, tool arguments and result images); carry typed thinking and tool-argument/output updates and local-command events live; account for session markers, summaries, extension notifications/status/widgets, retries and lifecycle signals; converge all live projections with persisted history; cover paging, reconnect and journal recovery in synthetic host-backed browser journeys and inspectable screenshots. This slice does not satisfy the issue acceptance criteria, so it remains in progress. Real Pi/provider behavior and live host verification were not attempted under the night conditions.
