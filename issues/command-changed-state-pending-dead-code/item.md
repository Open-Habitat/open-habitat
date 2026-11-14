---
created: 2026-11-02
updated: 2026-11-14
type: bug
status: fixed
priority: low
provenance: other
provenance_detail: found while fixing live-long-run-working-missed-under-load
source_ref: taskfleet:01m6dqa3f790m6d66yyfavs2nr/dead-command-state-pending
originating_run: 01m6dqa3f790m6d66yyfavs2nr
originating_run_kind: spinoff
lane: code-hygiene
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# conversationStore tests command.changed payload.state, which the contract never sends

## Description

`web/src/app/conversationStore.ts` tests `event.payload.state === "pending"`
for `command.changed` in three places: clearing attention in the metadata
routing, refreshing controller status for that conversation, and resetting the
live turn's fragments with `commandOutput(...)` in `applyEvent`.

The contract (`contracts/v1/event.schema.json`, `command.changed` payload) has
`additionalProperties: false` and only `acceptance`, `execution`, `error_code`
and `client_command_id`. The daemon sends exactly those
(`internal/daemon/conversation_linux.go` receipt, `held_linux.go`), so
`payload.state` is never present and all three branches are dead.

Likely intent is `payload.acceptance === "pending"` (a send held/queued by the
daemon: `conversation_linux.go` sets `acceptance=pending, execution=not_started`
for a queued send; `held_linux.go` sends `acceptance=pending, execution=failed`
for `pi_start_failed`). Whether reviving the branches with `acceptance` is right
— or the code should simply be removed — needs a look at what each branch was
meant to do: e.g. the `held_linux.go` start failure currently does not trigger
an immediate status refresh from the event, so the composer may rely on the
next status read to show it.

Found while implementing `live-long-run-working-missed-under-load` (noted in
its triage analysis); confirmed against the schema on 2026-11-02. User-visible
effect unverified.
