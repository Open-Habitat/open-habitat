---
created: 2026-10-27
updated: 2026-10-27
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: worker measurement during main-browser-suite-red
source_ref: taskfleet:01m5y9dwfdq22279j1ez97s0mq/suite-load-timeouts
originating_run: 01m5y9dwfdq22279j1ez97s0mq
originating_run_kind: spinoff
---

# Two browser waits time out under concurrent worker load (attachment-documents, lab typed fragments)

## Description

Observed 2026-10-27 on Birch at main d732c059 plus the main-browser-suite-red spec fixes, OH_BROWSER_WORKERS=4, while other workers ran focused specs (load average 9–15 on 8 vCPU; the whole-suite lock held off other whole suites):

- whole browser suite: 409 passed, 1 failed. `tests/attachment-documents.spec.ts:38` "documents preview in the app's dialog …": `.ah-composer [data-testid=attachment-chip]` count stayed 0 against the expected 6 within the default 5 s wait (line 73).
- lab suite: 136 passed, 1 failed. `tests/lab-conversation.spec.ts:607` "@lab typed Pi fragments converge …": `.ah-live-tool-row` count stayed 0 against the expected 1 within 20 s (line 636).

Both passed 3/3 when run alone right afterwards, at the same load. So they look timing-sensitive under CPU contention, not wrong. A whole suite going red while other workers run focused specs makes main's health hard to read and wastes reruns. Find out what each wait depends on (upload completion for six files; the delayed tool frame in the slow typed journey) and wait on that state instead of a fixed timeout, or show that the product really is too slow there.
