---
created: 2026-09-21
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 110
blocked_by: ['@archive-agent-conversations']
collision: [docs/, AGENTS.md]
preparation: pending
---

# Deliver the installation and operations guide

Make releases installable and recoverable, with generic self-hosting guidance
and a verified procedure for the authorized test installation. Build on the
existing reproducible release packaging and neutral service templates.

## Scope and ownership

Native Agent Host owns portable packaging and generic installation,
configuration, update, rollback, live-version and operator documentation.
Fleetrepo owns the test host's accounts, bindings, secrets, ingress and release
selection. Coordinate concrete deployment changes there; exact live commands
and receipts belong in its
`infra/native-agent-host-test/RELEASE-UPGRADE.md`.

Test releases proceed under that procedure, including any review it requires
from Jari before an operator's first live use. A production installation
remains a separate decision by Jari. A failed
preflight stops deployment because the procedure's assumptions about the host
or recovery path no longer hold.

The [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md) and
[ADR 0001](../../docs/adr-0001-unix-native-agent-host.md) define the intended
system: desktop first, one server and Pi, with native tools owning their
histories and configuration. Packaging preserves that ownership rather than
adding parallel histories, a workspace registry, credential broker or
speculative cache. The [delivery plan](../plan-v1-implementation/plan.md) is
historical context, not a current acceptance gate.

## Acceptance Criteria

- [ ] Implement and verify the recoverable release lifecycle described in
  [ADR 0003](../../docs/adr-0003-host-stack.md) and the gateway-to-daemon
  account mapping through release packages, without ad hoc persistent source
  installs.
- [ ] Verify both neutral templates and effective service configuration against
  [service-requirements.md](service-requirements.md), including isolation,
  privilege restrictions, native environment, shutdown, diagnostic privacy,
  frontend routing and the linked operator contract. Missing settings in a
  template do not waive a requirement; templates alone do not prove the
  installation meets it.
- [ ] Write `docs/operations.md` with prerequisites and exact generic
  install/update/start/stop/rollback and live-version commands, reproducible
  CI/package checks, ownership and backup/restore of native histories,
  workspace annotations and host configuration, and useful diagnostics within
  the required privacy boundary.
- [ ] Demonstrate installation from the standalone public guide and package on a
  separate clean Linux VM with a fresh agent and documented operator inputs,
  using two synthetic Unix identities. Exercise repeated apply, restart,
  update, failed activation and rollback; preserve native histories,
  credentials and workspace state. Repair guide or automation defects and
  repeat from a clean baseline rather than relying on undocumented manual
  repairs. Cleanup removes only fixture-owned state. Record the tested package
  revision and observed live version, without treating fixtures as real-person
  consent or installation on a production host.
- [ ] Exercise the authorized test-host upgrade through Fleetrepo's current
  procedure, confirming its rollback path is ready and using live switch-back
  only if the new release fails; record the Fleetrepo revision and observed
  outcome.
- [ ] Document cleanup/recovery instructions and the limits of the packaging
  evidence; installation tests alone establish no production availability claim.

## Evidence

Keep detailed work in this issue directory and record exact inputs, revisions,
commands, outcomes and remaining limits in `result.md`. Update the durable
documents this work owns, following the governing AGENTS.md files.
[TESTING.md](../../TESTING.md) defines the current implementation, packaging and
documentation checks and what their results prove. Distinguish verified
behavior from failed or unavailable checks so the pilot can build on the
evidence without inheriting unsupported claims.

## Decisions

### 2026-09-30T17:50:57Z · @claude

Rethink-night 30.9.: rethink-instructions / gpt-6-astra tiivisti toteutusissuen vastuujaon, hyväksymisehdot ja näytön; tein ilman Jaria varovaiset valinnat säilyttää tietoturvarajat, pysäyttää epäonnistuneeseen preflightiin, jättää tuotantokäyttöönoton erilliseksi päätökseksi ja olla tulkitsematta tietyn Fleetrepo-operaattorin hyväksyntää annetuksi. fact-check-instructions / claude-opus-5-5 tarkisti lähteitä vasten: täsmensin ensimmäisen live-operaattorin Jari-hyväksynnän, erotin valmiin rollback-polun vain vikatilanteessa tehtävästä live switch-backista, säilytin Acceptance Criteria -otsikon issuectl readyä varten, päivitin muokkauspäivän sekä tarkensin ADR 0003 -viitteen ja varmuuskopioinnin kohteet. Jarin kirjattuihin päätöksiin ei löytynyt ristiriitaa; runbookin tämänhetkinen operaattori on yhä hyväksymättä. Tämän issuen ulkopuolista Fleetrepo-runbookin epäselvyyttä ei ratkaistu tässä.
