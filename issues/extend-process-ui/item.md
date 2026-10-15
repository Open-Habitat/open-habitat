---
created: 2026-09-20
updated: 2026-10-15
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: processes
lane_seq: 1
collision: [docs/, design-system/]
preparation: ready
---

# Extend process visibility and controls after v1

Help users understand the background processes their agent has started and
read their output without leaving the conversation. This is accepted follow-up
design work for the implementer, covering L1–L5 in the
[TUI follow-up list](../native-agent-host-architecture/ui-design-later.md).
Those entries preserve the feature ideas and their limits; they are not a
commitment to implement every feature.

Start with read-only extension process inventory and one process's retained
output with live following. Observed v1 use should establish the need and shape
this first slice, particularly whether long-running processes are actually in
use. A useful view distinguishes an empty inventory from unavailable information,
lets the user pause following to read earlier output, and makes retention or
truncation visible.

The extension's actual interface determines what the browser can offer.
Establish and verify its contract for process identity, session association,
lifecycle and available output. The versions and paths in the follow-up list
are leads from the original report, not verified browser capabilities.
A small concrete design tried in a real agent conversation should expose
unsupported assumptions before they become implementation commitments.

Keep subprocess ownership with the agent and its extension. The user daemon
relays their information and supported commands over the agreed HTTP/SSE path.
Native histories and component configuration remain with their owners.
A new process service, workspace registry, parallel history or log store,
credential broker, internal tenant model or speculative cache would create
competing authority or duplicate native state and is outside this work.

This issue is complete when the first slice has a reviewed concrete design,
a verified extension contract and a rationale grounded in v1 use, with L1–L5
divided into bounded, individually reviewable implementation issues before
activation. Review the first design before activating its implementation issue.
Later controls, log search and stream filters, pinning, dock/status displays,
notifications and watchers remain conditional on native support and demonstrated
need, following the distinctions in L1–L5. Read-only visibility comes first,
controls later, and watchers later still.

The [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md) and
[conversation v1 brief](../native-agent-host-architecture/ui-design-conversation.md)
provide the surrounding decisions. Detailed plans, contract evidence and results
belong in this issue directory.

## Decisions

### 2026-09-30T17:41:12Z · @claude

Rethink-night 30.9.: rethink-instructions (gpt-6-astra) tiivisti toteuttajalle suunnatun tehtävän tavoitteeksi ja valmiin työn kuvaukseksi. Ilman Jaria säilytettiin ensimmäisenä lukutilan inventaario ja yhden prosessin loki, toteutusta edeltävä design-katselmointi sekä L1–L5:n pilkkominen; extensionin kyvyt jätettiin todennettaviksi. fact-check-instructions (claude-opus-5-5) korjasi vanhentuneen post-MVP-rajan Jarin 28.9. päätöksen perusteella ja päivitti updated-päivän. @review-mvp on obsolete, mutta blocked_by ja kaista jätettiin toimeksiannon mukaisesti ennalleen; niiden aikatauluvaikutusta ei ratkaistu tässä. Ei ristiriitaa säilytetyn Jarin päätöstekstin kanssa.

Jari 15.10.2026: process support is wanted now, modelled on the Pi extension he uses in the terminal, `npm:@aliou/pi-processes`. `review-mvp` is obsolete, so its block was removed and the issue moved to its own lane. First step: what the extension records natively and how the daemon can read it as the mapped user; then a prototype round for the UI.
