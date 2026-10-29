---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed in a worker's focused browser run
source_ref: taskfleet:01m64kqtkgfttg25ba4g5b5t57/flaky-csv-preview-390
originating_run: 01m64kqtkgfttg25ba4g5b5t57
originating_run_kind: spinoff
---

# Phone CSV preview scroll check in browser-editor.spec.ts is flaky under load

## Description

`web/tests/browser-editor.spec.ts` › "@browser-editor @a11y table, picture and page previews 390" fails intermittently when the whole spec runs with `OH_BROWSER_WORKERS=2` on loaded Birch:

```
Error: expect(received).toBeLessThanOrEqual(expected)
Expected: <= 1
Received:    66
> expect(Math.abs((await topRow()) - before)).toBeLessThanOrEqual(1);
```

Observed 29.10. three times in five full-spec runs: twice on the settings-polish branch, and once on unchanged `main` sources, where the next main run passed. It passes when run alone with `--tag`. The assertion reads the preview table's top row once, right after the text→preview switch. It doesn't poll, so it races the preview's scroll restoration: 66 is about the distance from the top of the file to mid-file, which suggests the table hadn't scrolled yet. Likely fix: `expect.poll(topRow)` and a tolerance check, or waiting for the preview's scroll-restored signal.
