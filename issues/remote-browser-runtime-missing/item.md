---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: normal
lane: remote-browser-runtime
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Server browser runtime missing outside the test server

## Observed

Jari 22.11.2026 on our staging installation after v0.1.4: the experimental server browser (`remote-browser`) cannot start — `browser status` answers `unavailable` and `browser start` fails with "native operation failed or is uncertain". TigerVNC and Chrome are missing. On our test server they are installed by the test installation's own operator, not by the product, so every other installation (staging and both pilots) lacks them.

## Expected

1. The product's installation and upgrade provide the server browser's runtime on every installation (both architectures), so the next release brings it everywhere without a separate operator step.
2. When the runtime is missing anyway, the error says so in plain words (the browser environment is not installed; this is for the administrator), not "native operation failed or is uncertain".
3. Consider whether the experimental switch should be shown at all on a server where the browser cannot start.

## Decisions

- Jari 22.11.2026: fix so it is in the next version.
