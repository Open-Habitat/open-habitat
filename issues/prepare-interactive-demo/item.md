---
created: 2026-09-25
updated: 2026-10-05
type: task
status: done
priority: high
lane: demo-ui
closed: 2026-10-05
closed_by: jari
---

# Prepare interactive synthetic workspace demo

## Purpose

Give Jari a locally launchable, interactive synthetic rehearsal of the accepted desktop workspace UI. This is parallel preparation toward a safely testable real demo, not evidence of live authentication, two-person consent or Linux user isolation. The completed @first-login-pilot-readiness records the scope of Jari's first-login approval; subsequent real-person use follows its own consent and current test-host procedure, not a separate demo issue.

## Current state

The original rehearsal and automated checks are complete; [result.md](result.md) records the implementation and clean committed-tree CI at its tested revision. [visual-acceptance.md](visual-acceptance.md) has the start/open/stop commands, screenshots, tested revisions and limitations. The UI has changed since those screenshots; they do not represent the current demo, which has not been re-verified for this review. The issue remains in `testing` until Jari makes a dated visual decision. Screenshots and automated tests do not stand in for that decision.

## Scope

The rehearsal uses production components and the accepted desktop design. Its deterministic loopback-only HTTP entrypoint shows clearly labelled synthetic identities and data, including workspace list/search/select, empty/partial/unavailable states and keyboard paths, without a TLS certificate warning. Fixture and test-provider routes stay out of production packages and public network listeners. Real OAuth, gh, root broker, tokens, provisioning, agent control and Fleetrepo changes are outside this rehearsal; a real first-login demo still requires the existing security, operator and human-review gates.

Production components and the accepted design define interactions and state semantics; prototypes do not authorize new controls. A new product/design choice belongs with Jari. The implementation stayed within `web/` and this issue folder: it includes a dev-only entrypoint and tests as well as flag-gated branches in production UI files. Changes to `scripts/vm-test.sh`, provisioning/runtime/auth/daemon code, shared root `AGENTS.md`, `docs/` or `design-system/` would cross the original scope boundary and need a reported collision before expanding scope.

## Acceptance Criteria
- [x] Exact reproducible commands for Jari to start/open/stop the loopback-only HTTP review, with visible synthetic label and clear description of what is simulated versus real; no global install or persistent service.
- [x] Usable desktop workspace flows and at least ready, empty, partial, unavailable and login-looking states from the same production components, without real credentials or certificate bypass; keyboard and basic accessibility checks.
- [x] Automated assertions for fixture exclusion from production build and loopback-only binding; relevant browser/component tests and clean `./scripts/ci-local.sh --clean --json` on committed tree.
- [x] `visual-acceptance.md` with revision, commands, states, evidence screenshots and limitations. Leave issue in `testing` for Jari's dated visual decision; a worker must not self-accept or close this user-visible UI work.

## Decision
2026-09-25: Jari explicitly requested parallel UI work while JIT isolation continues, with the goal of a working testable demo. This synthetic-only local rehearsal is the independently shippable UI preparation; it does not grant permission to expose or claim the real login pilot.

## Decisions

### 2026-09-30T17:49:51Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue käsiteltiin rethink-instructions-skillillä (gpt-6-astra); faktantarkistus fact-check-instructions-skillillä (claude-opus-5-5). Ilman Jaria säilytettiin kaikki rajaukset, hyväksymiskriteerit, testing-tila ja Jarin 25.9. päätös; erotettiin valmistunut synteettinen harjoitus odottavasta Jarin visuaalisesta hyväksynnästä. Faktantarkistus korjasi virheellisen väitteen toteutuksen rajoittumisesta testitiedostoihin (tuotanto-UI:ssa on lipulla rajattuja haaroja) ja täsmensi, että dokumentoidut kuvakaappaukset ovat vanhasta revisiosta: nykyinen demo on muuttunut eikä sitä tarkistettu tässä läpikäynnissä. Ristiriitoja Jarin aiempiin päätöksiin ei havaittu.

## Resolution

### 2026-10-05T13:14:10Z · @jari

Jari confirmed on 2026-10-05 that the synthetic demo has been tested and may be accepted. This closes the demo review, not live sign-in or multi-user isolation; historical screenshots retain their revision limits.
