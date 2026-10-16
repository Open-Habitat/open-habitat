---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: pi-runtime
lane_seq: 1
collision: [internal/daemon, contracts/v1]
preparation: ready
---

# Upgrade Pi to 1.3.0 on the test server and in the product

Jari, 2026-10-16: "voitaisiin päivittää uusi pi sekä alderlle että testiserverille joka tapauksessa. Sitten näistä malleista uusimmat käyttöön ja pohdinta, että miten pi:n konffeja muutetaan." (In short: upgrade Pi on both alder and the test server, start using the newest models, and think through how Pi's configuration should be changed.)

Pi `@earendil-works/pi-coding-agent` 0.85.1 → 1.3.0 (npm, published 2026-10-15). The product pins 0.85.1 in `internal/daemon/pi_runtime_linux.go`, `pi_models_helper.mjs`, `pi_device_helper.mjs`, `internal/daemon/pi-device-test/` and `contracts/v1/scenarios.json`. Fleetrepo installs the guest Pi through `infra/open-habitat-test/guest_pi_runtime.py` and `guest_pi_selector.py`. Upgrade risks are listed in `issues/research-model-discovery/report.md` (version-sensitive daemon APIs and JSON/RPC events; the new `openai` subscription provider versus `openai-codex`; codemode/MCP; tool exposure; the fullscreen default).

Models: Pi 0.85.1 already lists `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol` and `gpt-6.1-sol`. `gpt-5.x` is refused on the Codex route for Jari's ChatGPT account. "Newest models in use" means that the newest model which answers for the account (proved by one real request) becomes the native default, on alder for Jari and on the test server for the mapped user.

Jari, 2026-10-16: the choice offers the newest model of each family: luna, terra, sol and astra (for example `gpt-6-luna`, `gpt-6-terra` if the 1.3.0 catalog has it, `gpt-6.1-sol` and `gpt-6-astra`; take the actual newest from the catalog). Older generations are not offered by default.

## Acceptance Criteria
- [x] The product accepts and runs Pi 1.3.0. Daemon, helpers, contract scenarios and tests are updated, and nothing pins 0.85.1 any more.
- [ ] The test server runs Pi 1.3.0 through the Fleetrepo guest runtime operator. A signed-in browser turn is left for Jari. A mapped-user native prompt answers on the newest working model, and restart recovery still works.
- [x] The mapped user's native default is the newest working model (proved), and an existing openai-codex login still works or is migrated.
- [x] `issues/upgrade-pi-1x/config.md`: how Pi configuration (default model, thinking, provider login, extensions) is changed, by whom (person through the browser, Fleetrepo for alder, never a parallel host store), and what the browser contract needs. This is a proposal for Jari.
