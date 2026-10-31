---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: open
priority: normal
lane: remove-web-push
lane_seq: 1
related: ['@push-when-your-turn']
preparation: ready
---

# Remove Web Push notifications from the web product

Jari 31.10. (reviewing the 31.10. decisions): he does not want phone notifications in the web product yet; they belong to a future native app. Remove what `push-when-your-turn` added (`89e30d2f` and its follow-ups): the experimental feature and its settings card, the service-worker push handling, the daemon's push subscription store and sender (`internal/daemon/push_linux.go`), the contract (`contracts/v1/push-notifications.schema.json`), catalogs, tests, docs and `KOKEILTAVAA.md` lines. Restore `docs/product.md`'s line that browser/OS notifications stay outside the product. If Fleetrepo installs anything for it (VAPID keys, units, config), file the matching Fleetrepo change in the same round. Git history keeps the implementation for the native app (`native-app-notifications`).
