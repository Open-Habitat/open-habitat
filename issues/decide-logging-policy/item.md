---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: normal
related: ['@design-logging-policy', '@rewrite-architecture-docs']
lane: logging-design
blocked_by: ['@rewrite-architecture-docs']
---

# Decide and implement the logging policy

## Purpose

Operators need to understand where an operation failed and why, and to trace
relevant actions to their actor. The first-login investigations exposed errors
that were too generic to diagnose. Jari confirmed that traceability is a goal;
changes to shared server settings are one concrete use for knowing who acted.

Design the logging policy from current diagnostic and traceability needs, then
implement it. Read the existing gateway, broker and daemon logging and the
first-login investigations to identify what is already covered and what is
missing. The earlier @classify-broker-refusal work already added gateway-level
broker operation and failure classifications; the original proposal predates
that improvement.

## Approach

The proposal produced by @design-logging-policy is background for this work.
@rewrite-architecture-docs owns moving it from `docs/logging.md` to this issue's
`proposal.md`. Its event vocabulary, identity exclusions, correlation protocol
and three listed choices are suggestions to reassess, not an agreed contract
or an exhaustive definition of the problem.

Recommend a coherent policy that explains which events help diagnose failures
and trace relevant actions, how records belonging to an operation can be
connected, and what actor information those uses need. Balance that usefulness
with access, retention and volume limits. Secrets and conversation or tool
content do not belong in diagnostic logs; actor identifiers should be selected
for a concrete traceability need rather than excluded categorically. Unix user
isolation and the native sources of account and session state remain the
architectural basis.

Resolve architectural choices with Jari, including any change to how components
exchange correlation data. Event names and other implementation details follow
from the needs. Evaluate a user-facing support reference if it would help relate
a reported problem to the operator's records. Logging should remain bounded
and its failure should not alter an authorization result or prevent the
underlying operation from completing.

Implement the agreed policy and describe actual logging behaviour in the
architecture documentation. Product behaviour belongs here; concrete service
access, retention and ingress settings belong to Fleetrepo. Keep the current
decisions and their reasons in the relevant parts of this issue.

## Completion

An operator can diagnose representative failures and trace the relevant actions
under the agreed policy. Verification demonstrates useful correlation and actor
attribution where intended, protection of secrets and work content, and bounded
behaviour when logging is flooded or unavailable. Documentation explains what
is recorded, where it lives and who can read it, matching the implementation.
