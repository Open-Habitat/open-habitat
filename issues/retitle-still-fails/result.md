# Result

## Cause and evidence

The failed live request was **2026-10-21 17:32:55 UTC** (20:32:55 Finnish time). Read-only journal inspection found the same request ID on both sides:

- Daemon: `POST /api/v1/conversations/{id}/history_title`, status 200, duration **12,338 ms**.
- Gateway: `daemon_route`, reason `daemon_exchange_failed`; browser response 503, duration **12,339 ms**.

The daemon transport's normal write deadline is five seconds. Neither `historyTitle` nor `regenerateTitle` extended it, although model generation alone has a 15-second budget. Go can finish the handler and log 200 after its socket write deadline without delivering that response. The gateway then sees the failed exchange, not the handler's JSON. This is a different defect from the earlier stopped-history operation selection fixed in d3409c48. That earlier issue's result is in the historical `issues/title-regenerate-broken/item.md` (`git show 683316bf^:issues/title-regenerate-broken/item.md`), not a separate result file.

A new real-HTTP regression creates and settles a synthetic conversation, then exercises both the live handler and its stopped-history counterpart. A 120 ms model call outlives a 50 ms ordinary server write deadline. **Before the fix both subcases fail with EOF**, reproducing the lost reply without using personal histories or calling a real provider. Baseline log: `/var/tmp/retitle-baseline.log`.

The live logs establish the transport failure, not whether that particular provider call produced a title or a fixed model failure; the expired deadline hid either outcome. No personal conversation content, credentials or raw provider diagnostics were read or copied. No Fleetrepo installation change is indicated.

## Changes

- Both explicit title handlers extend only their own response write deadline to 45 seconds, beyond the existing bounded model/native work and below the gateway's 60-second finite request budget. Global transport limits and native ownership/writer proofs stay unchanged.
- Stopped-history model errors retain the same fixed timeout/invalid/unavailable reasons as live requests, with content-free diagnostic logging.
- The client retains allowlisted title failure codes and gives an actionable model-specific notice. A lost or unknown reply still tells the person to check the actual title/state before retrying. There is no automatic retry, fallback write, or exposure of provider text.
- Unit coverage rejects unknown reason text and proves neither title operation retries; no UI wording is asserted.

## Validation

Pending final results below. Tests use invented homes and fake Pi; they do not establish live-provider success or distinct-UID isolation. No full gate or deployment/push is part of this worker. The Finnish follow-up is in `KOKEILTAVAA.md`.
