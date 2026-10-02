# Pi dialogs in the browser

## Visual pairs (synthetic lab ↔ v2 working draft)

| Width | Light | Dark |
| --- | --- | --- |
| 1440 px | [Lab](pairs/light-1440-lab.png) · [Draft](pairs/light-1440-draft.png) | [Lab](pairs/dark-1440-lab.png) · [Draft](pairs/dark-1440-draft.png) |
| 390 px | [Lab](pairs/light-390-lab.png) · [Draft](pairs/light-390-draft.png) | [Lab](pairs/dark-390-lab.png) · [Draft](pairs/dark-390-draft.png) |

After a synthetic answer, the same fixture shows an [uncertain outcome](pairs/light-1440-answered-lab.png) instead of a fabricated acknowledgement ([offline HTML](pairs/light-1440-answered-lab.html)).

Each PNG has adjacent offline HTML. `NAH_PORT_BASE=15000 PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/show-dialog-pairs.mjs` generated these from a fresh synthetic lab. The fake Pi holds the working turn with two queued items and tool rows; the pending confirm dialog is injected into the **validated status response**, not a real provider or another user's history. The sidebar contains pre-existing read-only histories. I compared all four pairs: the draft has no dialog state, so its working layout is a composition benchmark, not a claim that the new dialog was in the draft. The dialog remains a single bordered timeline item with one primary answer, quiet alternative/cancel, no default-state explanation, and the same content gutter at desktop and phone widths. The question does push earlier content up in the phone viewport; scrolling preserves it.

## Result

Supported input, select and confirm requests have answer controls; all kinds including unknown can be cancelled. The browser sends `request_id` and the observed value to the per-conversation question route once, persists an attempt marker before writing, and never retries after a missing response, reload or 409. A successful HTTP reply remains **uncertain**, since Pi supplies no correlated receipt. A 409 is shown as possibly stale **or** uncertain delivery: the daemon currently uses the same response before and after spending an ID, so the browser cannot prove which occurred. This limitation is documented here rather than changing the daemon in this browser-only slice. Refresh observes the next pending request through status/events; it does not infer the prior answer from the absence of the question. Rendering uses text nodes, never untrusted HTML. The browser does not assert ownership itself: session, CSRF and daemon's Unix-user boundary decide admission.

## Evidence

- `./scripts/test-web-fast.sh`: passed (format, lint, typecheck, unit and component).
- Focused synthetic browser `@browser-conversation` question cases: input answer once across reload, unsupported cancel with 409, inert HTML, all passed. Component tests cover the four dialog kinds and no-retry presentation.
- Visual screenshots are synthetic host only. They cannot prove distinct kernel UIDs or provider acknowledgements. The earlier daemon/browser contract proof is in [the parent result](../answer-pi-dialogs/result.md).

The gate result and tested commit are recorded at closure.
