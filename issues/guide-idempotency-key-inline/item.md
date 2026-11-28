---
created: 2026-11-28
updated: 2026-11-28
type: bug
reporter: conductor
status: testing
priority: normal
provenance: chat
source_ref: chat:conductor-2711/guide-idempotency-key
lane: agent-offers
preparation: ready
lane_seq: 2
---

# Agent guide examples create the idempotency key inline, inviting retries with a new key

## Description

The agent guide's example for `open-habitat agent notice create` builds the
idempotency key inside the command
(`--idempotency-key "$(cat /proc/sys/kernel/random/uuid)"`,
`internal/daemon/host-context.md`), so the key is not kept and a retry easily
makes a new one, although the CLI says never to retry uncertain work with a
new key. Agents copy the same pattern to `view offer` and `file offer`; this
led to a duplicate card on 27.11.2026.

Fix the agent guide (the Open Habitat environment section and `open-habitat
skill print agent`) and the `--help` examples: create the key first in a
variable (or file), reuse the same key on retry, and when the result is
uncertain check `agent file list` / `agent view list` / `agent notice` state
before trying again.
