---
created: 2026-10-24
updated: 2026-10-24
type: chore
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m5p7mej1stazmymdtcwze1nk/gate:biome-format-capture-onboarding
originating_run: 01m5p7mej1stazmymdtcwze1nk
originating_run_kind: spinoff
---

# Clean gate fails: biome format on web/lab/capture-onboarding-ai-step-layout.mjs

## Description

`./scripts/ci-local.sh --clean --json` fails its web-checks phase at `biome format .` on current main (observed 2026-10-24 on base 02783d53; main ab8685e4 has the same line):

```
web/lab/capture-onboarding-ai-step-layout.mjs:77
  await page.getByTestId("api-key-input").fill("sk-proj-synthetic0000000000000");
```

Biome wants the call chain split over three lines (line too long). Impact: the clean gate cannot pass on main, so no gate receipt and no gated production release until it is reformatted. Fix: `npx biome format --write web/lab/capture-onboarding-ai-step-layout.mjs` (or `npm run format --prefix web`) and commit.

Found by the gitea-native-owner worker's full-gate run; that worker did not touch web/.
