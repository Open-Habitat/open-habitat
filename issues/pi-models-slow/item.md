---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: open
priority: normal
---

# GET /api/v1/pi/models takes 3 s and runs every minute

Conductor's observation on the test VM, 2026-10-19 07:45–07:55 UTC: the daemon logs `"slow":true` for `GET /api/v1/pi/models` about once a minute, 2.6–4.0 s each (e.g. request_ids `S20Grn9ITwXjWwkI`, `pGVNhcz9PHfAhvGy`, `lh44Pld_elNa1yEu`), and `GET /api/v1/onboarding/pi/status` at 1.7–2.0 s. Find what the model list does on every call (spawning Pi? reading provider catalogues?) and whether the browser polls it once a minute. Pressing **+** or opening Asetukset › Agentit waits on it.
