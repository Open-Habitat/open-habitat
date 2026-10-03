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

Design and implement logging that helps operators diagnose failures and trace
relevant actions to their actor, such as who changed shared server settings.

Start from the current gateway, broker and daemon logging to identify gaps.
The gateway already records broker operations and safe failure classifications.

## Approach

Define which events are useful, how records belonging to the same operation
can be connected, and what actor information is needed for traceability.
Choose access, retention and volume limits that preserve diagnostic value
while limiting exposure of user information. Secrets and conversation or tool
content do not belong in diagnostic logs. Record actor identifiers where they
serve a concrete traceability need.

Unix user isolation and native account and session state remain the
architectural basis. Resolve architectural choices with Jari, including changes
to how components exchange correlation data. Choose event names and other
implementation details to serve the diagnostic needs. A user-facing support
reference may help connect a reported problem to the operator's records.

Logging should remain bounded, and its failure should not alter an authorization
result or prevent the underlying operation from completing. Product behaviour
belongs in this repository; concrete service access, retention and ingress
settings belong to Fleetrepo.

## Completion

An operator can diagnose representative failures and trace relevant actions.
Verification demonstrates useful correlation and actor attribution, protection
of secrets and work content, and bounded behaviour when logging is flooded or
unavailable. Architecture documentation explains what is recorded, where it
lives and who can read it, matching the implementation.
