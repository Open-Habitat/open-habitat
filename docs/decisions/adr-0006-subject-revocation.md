# ADR 0006: Local gateway subject revocation

**Status:** Accepted — Jari approved the original operation on 2026-09-29 and
retained its limited scope on 2026-10-02.

## Context

A one-time test-account reset needed to end one person's browser sessions
without restarting the shared gateway or disturbing other users. The gateway
owns browser authentication; native credentials, conversations and processes
belong to the person's Unix account.

## Decision

Provide a local root-only control socket for revoking one GitHub subject's
browser sessions. The gateway verifies the caller's kernel UID and asks the
broker to authorize the stable GitHub ID and confirm its account binding
before changing session state. This keeps the operator action under local
root authority and uses the broker's existing identity binding.

Revocation removes the subject's sessions and prevents login flows started
before it from issuing a session. Pending OAuth flows reveal their subject
only when GitHub identifies the person, so the gateway checks their start
order at callback, including after native credential handoff. Other people's
sessions and pending logins remain valid.

## Scope and limits

Requests authenticate against gateway sessions without repeated broker
queries. Editing the allowlist alone therefore does not end existing sessions.
Broker authorization requires admission and a ready daemon socket, so
revocation must precede changes to either. These operations are not atomic:
a new login started after revocation can still succeed while admission remains
allowed.

Already-admitted requests and streams continue. Revocation leaves native
credentials, processes, conversations and writer locks intact; an in-flight
login may complete credential handoff without obtaining a browser session.

On 2 October, Jari [declined extending targeted revocation](../../issues/reliable-session-revocation/item.md):
rebuilding the test environment meets the current reset need. General account
removal remains [deferred](adr-0007-bound-user-deprovision.md).

The original implementation keeps sessions and login flows in memory. The
later [durable sign-in requirement](../../issues/design-durable-sign-in/item.md)
calls for preserving login across gateway restarts; its design is pending.

[Identity and trust](../architecture/identity-and-trust.md) describes current
behavior, and [deployment](../architecture/deployment.md) covers operator use.
