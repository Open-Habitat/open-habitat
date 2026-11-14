# Research result

[Workmux benchmark and candidate designs](research-workmux.md) compares workmux
0.1.282, Taskfleet's current attention/message surfaces, and Claude Code teams.
Workmux supplies status/capture/terminal-send orchestration, not a correlated
worker-to-parent question protocol. Taskfleet already supports durable live
awaiting-input events; the gap is a cross-harness answer exchange.

Recommendation for discussion: a durable blocking CLI ask/answer in Taskfleet,
with Habitat projecting state and waking the parent through its native observer.
The report offers three proposals; no design is approved and the issue stays open.
Preparation returns to pending for discussion.

## Decisions for later review

- Treat parent-first handling as the requirement, not a request to bypass human
  permissions. Alternative: surface every worker question directly to the person.
  Reason: the recorded product direction reserves human interruption for decisions
  the parent cannot make.
- Recommend a cross-harness shell exchange rather than expanding Pi-only live
  steering first. Alternatives and costs are in proposals B and C. Reason: the
  question/answer identity must survive disconnected adapters and work for all
  requested harnesses.
- Separate startup-silence detection and non-blocking notes from decision asks.
  Alternative: one generic messaging feature. Reason: a worker blocked before
  its agent loop cannot execute an ask; notes need no decision deadline.

## Verification

Focused self-review against pinned source, installed CLI help and vendor docs;
checked reference paths and whitespace. No runtime tests needed for this
issues-only research. No live inter-agent delivery experiment was performed.

Live check: no test-server behavior changed. Read the report and discuss proposal
A against B/C; there is no new worker-question control to try yet.
