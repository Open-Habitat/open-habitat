---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while stabilising browser specs
source_ref: taskfleet:01m7z8mgmn9va9m6v4b6p2efwh/observed:rail-archive-restore-does-not-hold
originating_run: 01m7z8mgmn9va9m6v4b6p2efwh
originating_run_kind: spinoff
---

# Rail archive restore sometimes does not hold under load (rail-archive spec)

## Description

## Description

`web/tests/rail-archive.spec.ts` › "a rail conversation archives from its row on hover or by keyboard, without opening it, and comes back from the notice" fails intermittently under load. With `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250`, `OH_BROWSER_WORKERS=2`, it failed 1 of 30 runs on main (ee4b40b9) and 1 of 20 on a branch that changes nothing on this path.

Both failures are the same. The keyboard archive succeeds, and the row comes back from the notice's restore. Then the case opens the conversation and presses the row's archive button for the refusal step. The click waits until the 60 s test timeout. At that point the conversation's row has left the rail again, and the opened view says it is archived ("Arkistoitu … palauta jatkaaksesi"). So the restore that drew the row back did not hold. Either a read or event from before the restore later redrew the conversation as archived, or the restore itself did not take effect while the row was redrawn optimistically.

Find out which, and whether a person can see the same thing: restore from the notice, and a moment later the conversation is archived again. If the product holds, make the spec wait for the restore to settle before it continues.

Reproduce from `web/`:

```
OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250 OH_BROWSER_WORKERS=2 npx playwright test tests/rail-archive.spec.ts --grep "archives from its row on hover or by keyboard" --repeat-each 30 --trace retain-on-failure
```
