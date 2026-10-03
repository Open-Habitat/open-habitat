# ADR 0007: Removing a bound Unix account (deferred proposal)

**Status:** Deferred; not implemented. Jari confirmed on 2026-09-30 that
individual account removal is a later need. Resetting the entire test system
is sufficient for the current test environment.

## The need

A user may eventually want a “delete me” action. An administrator will also
need a CLI command for removing an individual user from the system. These are
two ways of requesting account removal whose scope and authority still need
to be designed. Neither capability is scheduled for the current work.

The original proposal arose from a one-time request to remove a test account.
A full test-server rebuild superseded that operation, as recorded in the
[account-removal issue](../../issues/deprovision-bound-user/item.md). The old
pilot.11 migration is no longer a prerequisite for meeting that test need.

## Why removal needs design

The current broker stores live provider-subject-to-Unix-account bindings and
checks that each account exists. Deleting only the Unix account leaves a
binding that fails verification. Deleting only the binding makes its UID
available again while files or processes may still belong to that UID.
Removing an account therefore needs to account for its binding, running work,
data and access, while preserving other users' data and isolation.

Browser logout ends a browser session. Disconnecting GitHub or OpenAI concerns
native credentials. Neither operation means deleting the Unix account, and
local account deletion alone does not revoke provider-side grants.

## What remains undecided

The deletion scope, handling of interrupted removal, UID reuse and subsequent
login remain open. So do the user-facing request and administrator command,
and how their authority fits the existing gateway, daemon and root broker.
The earlier proposal for permanent retired records, an independent history
commitment and a host-wide deletion journal was not adopted. A future design
should start from the concrete removal need and the implementation then in use.
