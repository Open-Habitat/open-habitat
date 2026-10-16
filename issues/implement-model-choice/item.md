---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: testing
priority: high
lane: pi-runtime
lane_seq: 2
collision: [internal/daemon, contracts/v1, web/src/app/, web/src/components/]
blocked_by: ['@upgrade-pi-1x']
preparation: ready
---

# Implement model choice (Käytön merkit)

Implement the model choice that Jari accepted on 2026-10-16: direction **1, Käytön merkit**, of prototype round `design-system/prototypes/rounds/2026-10-16-mallit/`. The accepted prototype is the specification. Read `issues/proto-model-discovery/result.md` (common rules and direction 1, plus the Decisions section), `issues/research-model-discovery/report.md` and `architecture.md`.

In short:
- One picker in four places: Asetukset → Agentti · Pi (the native default in Pi's own settings), the top-bar chip popover for this conversation, the composer pill for a new conversation, and inline recovery in the unsupported-model notice.
- The newest model of each family is offered (luna, terra, sol, astra, and any family that appears later), with older generations under a collapsed "Vanhemmat mallit (n)".
- The thinking level sits next to the model and is limited to the levels the model supports.
- Marks come only from the person's own native conversations ("Vastasi …", "Torjuttu …", "Ei kokeiltu"), derived from native Pi history each time; there is no host store. There is no probing.
- Model change in the same conversation is offered only if Pi 1.3's native session model switch is proven safe; otherwise the recovery offers a new conversation with model X. No silent replay.

Depends on `upgrade-pi-1x` (the Pi 1.3 catalog and APIs).

## Acceptance Criteria
- [x] The views match the prototype's direction 1 in lab screenshots (desktop and phone, light and dark), and every deviation is justified.
- [x] The daemon reads the catalog and per-model marks from native Pi state as the mapped user, with no new store. The contract additions are in `contracts/v1`.
- [x] Browser tests cover the default change, the per-conversation choice, notice recovery and the "Vanhemmat" grouping.
- [ ] Deployed to the test server, with the remaining live checks listed for Jari in KOKEILTAVAA.md.
