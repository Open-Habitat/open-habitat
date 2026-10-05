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

A self-hosting operator should be able to install a release, identify what is
running, update it and recover from failure using the public package and guide.
The work includes fixing packaging or automation gaps that prevent this, not
just describing the current tools. Users' native histories, credentials and
workspace state remain outside replaceable releases.

## Scope and approach

Native Agent Host owns portable packaging, neutral service templates and
`docs/operations.md`. Fleetrepo owns the test installation's accounts, bindings,
secrets, ingress and release selection. Its
`infra/native-agent-host-test/RELEASE-UPGRADE.md` describes live deployment;
its private inventory and issue results hold installation facts and receipts.
A public self-hosting guide should be usable without those private materials.

[ADR 0003](../../docs/decisions/adr-0003-host-stack.md) defines generic immutable
releases, atomic activation and a known-good predecessor for rollback.
The disposable test server follows the later [project policy](../../AGENTS.md):
releases, including a new operator's first use, proceed autonomously and failures
may be fixed forward or replaced by a fresh installation. It needs no retained
rollback release. Production installation remains Jari's separate decision.
A failed preflight identifies an assumption to repair or a reason to reinstall;
it is not evidence that the attempted deployment is safe.

The [deployment architecture](../../docs/architecture/deployment.md) describes
current behavior and gaps. [Service requirements](service-requirements.md)
define isolation, native environment, shutdown, diagnostic privacy, frontend
routing and the operator contract. These protect users' files and authority;
verify both the shipped templates and effective installation. Template text
alone cannot establish the running system's behavior.

## Acceptance Criteria

- [ ] Release packages implement the generic lifecycle and authenticated
  gateway-to-daemon account mapping, without persistent source installs.
- [ ] `docs/operations.md` covers prerequisites, configuration, exact generic
  install/update/start/stop/rollback and live-version commands, reproducible
  package checks, diagnostics, cleanup and recovery. It explains ownership and
  backup/restore of native histories, credentials, workspace annotations and
  host configuration, including the effect of service restarts on active work.
- [ ] A fresh agent can use the public guide and package on a separate clean
  Linux VM with documented operator inputs and two synthetic Unix identities.
  Evidence covers service requirements, repeated apply, restart, update, failed
  activation and rollback, with native data and credentials preserved. A clean
  run after repairs shows the guide is self-contained; fixture cleanup leaves
  unrelated state alone.
- [ ] A release runs on the authorized test host through Fleetrepo's current
  procedure, with the observed live version and deployment outcome recorded.

## Evidence

Record package and Fleetrepo revisions, operator inputs, commands, observed
results and remaining limits in `result.md`; keep secrets out of the evidence.
[TESTING.md](../../TESTING.md) describes the relevant checks. Distinguish a
verified installation from untested behavior: synthetic identities do not prove
real sign-in or production availability.

## Decisions

The September note below records the earlier rewrite. Its first-use approval
and test-host rollback assumptions have been superseded by the current project
policy and Fleetrepo runbook described above.

### 2026-09-30T17:50:57Z · @claude

Rethink-night 30.9.: rethink-instructions / gpt-6-astra tiivisti toteutusissuen vastuujaon, hyväksymisehdot ja näytön; tein ilman Jaria varovaiset valinnat säilyttää tietoturvarajat, pysäyttää epäonnistuneeseen preflightiin, jättää tuotantokäyttöönoton erilliseksi päätökseksi ja olla tulkitsematta tietyn Fleetrepo-operaattorin hyväksyntää annetuksi. fact-check-instructions / claude-opus-5-5 tarkisti lähteitä vasten: täsmensin ensimmäisen live-operaattorin Jari-hyväksynnän, erotin valmiin rollback-polun vain vikatilanteessa tehtävästä live switch-backista, säilytin Acceptance Criteria -otsikon issuectl readyä varten, päivitin muokkauspäivän sekä tarkensin ADR 0003 -viitteen ja varmuuskopioinnin kohteet. Jarin kirjattuihin päätöksiin ei löytynyt ristiriitaa; runbookin tämänhetkinen operaattori on yhä hyväksymättä. Tämän issuen ulkopuolista Fleetrepo-runbookin epäselvyyttä ei ratkaistu tässä.
