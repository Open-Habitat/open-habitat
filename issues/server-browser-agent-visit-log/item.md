---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
lane: server-browser-log
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Prototype: a record in the conversation of what the agent did in the server browser

## Observed (testing agent, 22.11.2026)

After an agent used the person's server browser, nothing in the conversation said which pages it visited; the window list showed only the person's window (`agent: false`) at the end, and it is unclear whether the agent's tab was marked as the agent's while it worked. The tester suggests a line in the conversation, e.g. "Agentti käytti selaintasi 4.42–4.48: airbnb.fi/trips, 10 varaussivua, 13 kuittia", as a record and an acknowledgement — for trust.

## Decisions

### 2026-11-22T06:18:38Z · @jari

Jari 22.11.2026: the OpenAI-built round is unusable and is discarded; redo with a Claude worker.

### 2026-11-22T07:24:53Z · @jari

Jari 22.11.2026: direction 2 Kortti accepted; deriving the record from native history (browser CLI results carry url/title, download names) rather than a browser-host log: accepted; detail shows path and title without query: accepted; in a shared conversation a participant sees the summary, not the detail: accepted. The card's final look is settled together with server-browser-entry-points round 3 (the conversation's browser display as one design). The data side starts now as server-browser-visit-data.
