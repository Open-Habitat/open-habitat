---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: conductor
status: untriaged
priority: normal
provenance: chat
source_ref: suite:2026-10-28/r29/lab-snapshot-refresh-live
---

# Lab suite: snapshot-refresh-live spec loses a response body under load

## Description

Lab suite on main 71340904 (Birch, 28.10. r29): tests/lab-snapshot-refresh-live.spec.ts:13 '@lab failed snapshot refreshes during a live turn show no connection loss' failed in page.waitForResponse: response.text: Protocol error (Network.getResponseBody): No data found for resource with given identifier (near line 88, expect.poll failed > 2). Passed 3/3 alone. The test reads the body of a response Chromium may already have evicted; likely a test-side race rather than a product defect. Log: ~/.local/state/oh-conductor/suite-r29/lab.log on Birch.
