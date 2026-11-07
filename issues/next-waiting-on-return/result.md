# Result

The visit's first fresh status now opens the waiting-navigation window when the
agent is working. It still ends on completion, a question, failure or archive;
a later external send does not reopen an already-ended window. Draft suppression
and Alt+Down behavior are unchanged. Late send callbacks from a previous visit
remain fenced by the visit token.

## Evidence

`./scripts/test-focused.sh --area web`: 179 files / 1352 tests passed, including
the added fresh/stale arrival and return regression. Focused host-backed
`next-waiting-row.spec.ts`: all four journeys passed with
`OH_PORT_BASE=15300 OH_BROWSER_WORKERS=2`. Its return case navigates away, starts
work there and returns to the still-working original conversation with another
waiting; it also tests reload and later external sending. Tested implementation
through `4db5c4430`. Focused self-review of the local view-state hook, effect
ordering, old-visit callbacks and draft suppression; no session-state owner or
wire changes. Synthetic evidence only, not a live-provider test.

## Decisions for later review

- A reload or direct opening of a working conversation also counts as arrival.
  Alternative: distinguish only rail returns using extra navigation memory.
  Chosen because the useful fact is that this agent is working while another
  waits, irrespective of how the person reached the view. Only the first fresh
  status can open it this way; later external sends keep the prior rule.
