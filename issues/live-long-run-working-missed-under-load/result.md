# Result

Option (d) implemented: `ConversationStore.publish()` updates the window value
at once but notifies the window's `useSyncExternalStore` listeners from one
16 ms `setTimeout` flush per batch of dirty ids. `applyStatus`, metadata and
`dispose()` notifications stay synchronous; `dispose()` clears the timer.
New unit test: 50 live events in one task → one window notification, carrying
sequence 50.

## Pass counts under load

Birch (8 vCPU), 2.11.2026, `OH_PORT_BASE=10470`, unchanged
`live-long-run.spec.ts` with `--repeat-each 8 --workers 4` beside 14 busy
loops under `timeout`; load average 34–40 during the runs (other workers were
also active on the host, so heavier than the triage's 25–30). Runs alternated
before/after.

| tree | run 1 | run 2 | total |
| --- | --- | --- | --- |
| before (HEAD~ store) | 0/8 | 0/8 | 0/16 |
| after (coalesced) | 8/8 | 8/8 | 16/16 |

Before, 15 failures were at `data-working="true"` and one at the 7000 ms
working-span check. After, every run passed in about 50 s per batch of 8.

Unloaded, with the change: browser-conversation 77, queued-send 13,
github-stream 2, live-long-run 1, lab-conversation-scroll 6, lab-long-stream 1,
lab-conversation 14 — all passed. Vitest 1221/1221.

## Review

Focused self-review plus one `/llm-review` (finder gpt-6-astra, no verifier):
no findings.

## Incidental

The `command.changed` `payload.state === "pending"` branches are dead (the
schema forbids `state`); filed as `command-changed-state-pending-dead-code`.

## Decisions for later review

- Flush interval 16 ms via `setTimeout`, as in the triage experiment.
  Alternatives: `requestAnimationFrame` (stops in hidden tabs) or a microtask
  (would not coalesce events arriving in separate SSE tasks). Chosen because
  it was the measured variant and keeps background tabs current.
