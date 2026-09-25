---
created: 2026-09-25
updated: 2026-09-25
type: task
status: open
priority: high
lane: demo-ui
---

# Prepare interactive synthetic workspace demo

## Goal
Provide Jari a locally launchable, interactive **synthetic UI rehearsal** of the already accepted desktop workspace slice while the real first-login pilot is blocked. This is parallel preparation toward a safely testable real demo, not a replacement for @first-login-pilot-readiness or @deliver-login-pilot.

## Boundaries
- Use the existing production components and accepted desktop design as the reference. Build a deterministic loopback HTTP-only manual review entrypoint with synthetic, clearly labelled identities and data; workspace list/search/select, empty/partial/unavailable states and keyboard paths should be directly testable without a TLS certificate warning. Keep fixture and test-provider routes absent from any production package and public network listener. No real OAuth, gh, root broker, tokens, account provisioning, agent control or Fleetrepo changes.
- Do not invent UI controls or state semantics from prototypes. If a proposed interaction needs a product/design decision, document it for Jari rather than implementing it. This is a local simulated rehearsal; a real first-login demo still requires the existing security, operator and human-review gates.
- Limit implementation to web/test-only entrypoint and isolated test or issue artifacts. Do not edit `scripts/vm-test.sh`, provisioning/runtime/auth/daemon code, shared root `AGENTS.md`, `docs/` or `design-system/`. If unavoidable, stop and report the collision before expanding scope.

## Acceptance Criteria
- [ ] Exact reproducible commands for Jari to start/open/stop the loopback-only HTTP review, with visible synthetic label and clear description of what is simulated versus real; no global install or persistent service.
- [ ] Usable desktop workspace flows and at least ready, empty, partial, unavailable and login-looking states from the same production components, without real credentials or certificate bypass; keyboard and basic accessibility checks.
- [ ] Automated assertions for fixture exclusion from production build and loopback-only binding; relevant browser/component tests and clean `./scripts/ci-local.sh --clean --json` on committed tree.
- [ ] `visual-acceptance.md` with revision, commands, states, evidence screenshots and limitations. Leave issue in `testing` for Jari's dated visual decision; a worker must not self-accept or close this user-visible UI work.

## Decision
2026-09-25: Jari explicitly requested parallel UI work while JIT isolation continues, with the goal of a working testable demo. This synthetic-only local rehearsal is the independently shippable UI preparation; it does not grant permission to expose or claim the real login pilot.
