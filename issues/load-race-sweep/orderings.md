# Jari 2.11.: orderings, and without the whole host and browser

Two additions after the sweep started (kept in a separate file so the sweep
worker's edit of item.md does not conflict). The fix/prevention unit reads
both as requirements.

1. **Simulate different orderings, not only slowness.** Slowness yields one
   new order ("everything late"). Replies and events are delayed by a
   seeded random amount and occasionally reordered, so each run tries a
   different interleaving; a failure prints its seed so it reproduces exactly.
2. **Most of it without the synthetic host or a real browser, in
   milliseconds.** The races found so far live in browser state logic
   (store, effects, focus and caret), which can be driven in Vitest/jsdom
   with fake timers and a fake transport the test controls step by step:
   deliver this reply before that event, then the other way round, and
   enumerate the orders systematically. `ConversationStore` already takes
   its pager as a parameter in tests, so part of the seam exists. What still
   needs a real browser: layout and CSS, real render throughput (the
   per-event re-render), and a few end-to-end journeys through gateway and
   daemon. Target: ordering tests in seconds; the browser suite keeps the
   journeys, not the race hunting.
