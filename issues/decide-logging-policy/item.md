---
created: 2026-10-03
updated: 2026-10-05
type: task
reporter: jari
status: done
priority: normal
related: ['@design-logging-policy', '@rewrite-architecture-docs', '@implement-diagnostic-emitter', '@correlate-diagnostics']
lane: logging-design
blocked_by: ['@rewrite-architecture-docs']
commits:
- hash: 11b94304ad7e7284551e4374d9fc0f8553557463
  summary: 'docs: rewrite the architecture as a present-tense system description'
preparation: pending
closed: 2026-10-05
closed_by: jari
---

# Decide and implement the logging policy

## Purpose

Design and implement logging that helps operators diagnose failures and trace
relevant actions to their actor, such as who changed shared server settings.
The gateway already records broker operations and safe failure classifications,
but records from different components cannot yet be reliably connected.

The [source inventory](preparation.md) describes current coverage and gaps.
The [policy proposal](proposal.md) recommends how to close them; the
[test results](result.md) describe the evidence already available.

## Approach

Choose events and fields for concrete diagnostic and traceability needs.
User IDs, email addresses and other useful user identifiers may appear in logs.
Use the identity known to the component authorizing an action when attributing
it to an actor. Secrets and conversation or tool content do not belong in
diagnostic logs. Access, retention and volume limits should preserve useful
evidence while limiting exposure of user information.

Unix user isolation and native account and session state remain the
architectural basis. Resolve architectural choices with Jari, including changes
to how components exchange correlation data and who can read their logs.
Event names, field details and practical limits follow from the diagnostic
needs. A user-facing support reference may help connect a reported problem
to the operator's records.

Logging should remain bounded, and its failure should not alter an authorization
result or prevent the underlying operation from completing. Product behaviour
belongs in this repository; concrete service access, retention and ingress
settings belong to Fleetrepo.

## Outcome

The agreed policy is [ADR 0013](../../docs/decisions/adr-0013-service-logging.md): readable, consistent service logs using existing IDs. The [earlier implementation plan](implementation-plan.md) is withdrawn and retained only for context. Current work is @implement-diagnostic-emitter, then @correlate-diagnostics; the test-server journal instructions and verification are Fleetrepo's `nah-diagnostic-log-access`.

## Completion

An operator can diagnose representative failures and trace relevant actions.
Verification demonstrates useful existing identifiers and actor attribution,
protection of secrets and work content, and that log failures do not change
operation outcomes. Architecture documentation explains what is recorded, where it
lives and who can read it, matching the implementation.

## Decisions

### 2026-10-04T05:45:35Z · @claude

Jari 2026-10-04: preparation.md:n lokitussuositus hyväksytty sellaisenaan. Seuraava askel on toteutussuunnitelma tämän issuen hakemistoon ennen varsinaista ohjelmointia; toteutus alkaa vasta suunnitelman jälkeen.

### 2026-10-05T11:54:13Z · @claude

Jari 2026-10-05: the four open questions in the then-current implementation plan were initially settled as recommended: attempt ID across channels, a separate support reference, a root/operator/owner reader model, and 7/30 day retention. This design was withdrawn later the same day in favor of the simpler service logging decision in current ADR 0013.

## Resolution

### 2026-10-05T11:59:15Z · @jari

At the time, the now-withdrawn tracing design was accepted; implementation was split into @implement-diagnostic-emitter and @correlate-diagnostics, deployment into Fleetrepo nah-diagnostic-log-access. The current scope is in ADR 0013.
