---
created: 2026-11-02
updated: 2026-11-02
type: improvement
reporter: jari
status: done
priority: high
lane: history-first-page
lane_seq: 1
collision: [web/src/app/HistoryView.tsx, internal/daemon/history_linux.go]
preparation: ready
closed: 2026-11-02
---

# Opening a conversation shows only a couple of messages of history

## Description

Jari 2.11. (opening this conductor conversation on a new machine): the
conversation showed only one or two messages and a *Lataa vanhempi
historiasivu* button; the history did not even reach the top of the page.
That looks broken. He wants the first load to bring **at least 100–200
messages** of history.

Now the browser asks the first page with `limit: "25"`
(`web/src/app/HistoryView.tsx`) and the daemon caps a page at
`historyPageBudget = 256 KiB` (`internal/daemon/history_linux.go`). In a
tool-heavy conversation 25 entries (tool calls and results count) or 256 KiB
cover only the last turn or two.

Make the first page show 100–200 user/assistant messages (tool entries do
not count against that figure), and the older-history page similarly
generous, while keeping a stated bound on bytes and render cost (long tool
outputs are collapsed already; measure a long real conversation such as this
conductor's). At minimum the first page always fills the viewport.

## Acceptance Criteria

- [ ] Opening a long tool-heavy conversation shows on the order of 100–200 messages without pressing *Lataa vanhempi*.
- [ ] Page bytes and first-render time stay bounded and measured; tests cover the new boundary.
