# Current status

**Updated:** 2026-09-19
**Source revision:** `04319441e9a3ecce6882d04e0a7614f902afa734`

## The approach is agreed

Native Agent Host will give browser access to agents running under ordinary Linux
accounts. Each user has a lightweight daemon behind a shared authentication
gateway. Workspaces come from `~/src`; conversations and configuration stay with
Pi, Claude Code or Codex. The daemon reads existing information and adds only what
a concrete use case needs.

The first API uses JSON/HTTP and one combined SSE event feed per server. The design
is recorded in [ADR 0001](adr-0001-unix-native-agent-host) and explained in
[how the system works](architecture).

The first working implementation is not built yet. Research covers Alder, Northwind,
the two Acme Creator implementations and candidate tools. The benchmark fixture
is in place, but no protocol has been shown to pass its B1–B8 scenarios.

## Next: one working path on Alder

Connect one browser through the gateway to one user's daemon. List a workspace,
find and resume a Pi conversation, accept a command and stream its events. Check
reconnect and continued use through SSH and tmux. The [implementation page](implementation)
describes the steps and checks.

Authentication, daemon packaging, Pi discovery, process controls and exact API
formats still need to be worked out. No cache is needed until measurement finds a
slow path, and no annotation is needed until something actually uses it.

## What remains unverified

Alder still needs observation of terminal attachment, second-user separation,
failure outcomes and cleanup. The Northwind study lacks representative interviews,
macOS and live Claude observations, and a controlled concurrency trial.

The Native Creator study could not inspect the private fork or installed package,
or test live provider and Moodle behavior. The Creator web study lacked an
authenticated test account and host, database and log access; restore and Moodle
integration were not tested. These gaps mean the behavior is unknown, not absent.
The [research index](evidence) links to the details.
