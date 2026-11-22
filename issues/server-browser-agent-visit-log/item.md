---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: testing
priority: normal
lane: server-browser-log
lane_seq: 1
preparation: ready
---

# Prototype: a record in the conversation of what the agent did in the server browser

## Observed (testing agent, 22.11.2026)

After an agent used the person's server browser, nothing in the conversation said which pages it visited; the window list showed only the person's window (`agent: false`) at the end, and it is unclear whether the agent's tab was marked as the agent's while it worked. The tester suggests a line in the conversation, e.g. "Agentti käytti selaintasi 4.42–4.48: airbnb.fi/trips, 10 varaussivua, 13 kuittia", as a record and an acknowledgement — for trust.
