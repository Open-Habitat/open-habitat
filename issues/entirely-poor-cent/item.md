---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
originating_run: 01m5pxrv6n5tjszbnwkmy321fg
originating_run_kind: spinoff
---

# Flaky browser spec: title dots route handler reads a disposed snapshot response

## Description

`web/tests/browser-conversation.spec.ts:3231` ("@browser-conversation title dots follow automatic observations and manual replies") failed once in the clean gate (`./scripts/ci-local.sh --clean --json`, run 01m5pxrv6n5tjszbnwkmy321fg, 2026-10-24, tree at commit bcc4d42c-era, 1 failed / 359 passed) and passed when run alone right after.

Failure:

```
Error: apiResponse.json: Response has been disposed
  3239 |   await page.route("**/api/v1/snapshot", async (route) => {
  3240 |     const response = await route.fetch();
> 3241 |     const body = await response.json();
```

The test's route handler reads the fetched snapshot body after Playwright has disposed the response, which looks like a race in the test (for example a page navigation or route teardown while a snapshot fetch is in flight), not a product defect. The change under test touched no web or conversation code. Impact: an intermittent red clean gate, which blocks gated releases and costs a rerun.
