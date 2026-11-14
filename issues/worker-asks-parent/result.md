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

# Design result (14.11.2026)

[Design for review](design.md): the end-to-end flow of a worker's question, the
agent's own `handoff` declaration for the rail, phasing, and a self-contained
Taskfleet proposal (§4, not filed, Taskfleet unchanged). Nothing is
implemented; both issues stay open with preparation pending until Jari has
reviewed the design and answered its §6 questions.

The decisions made by judgement are listed in the design's §5 "Decisions for
later review", each with its alternative and reason.

Review: focused self-review of every claim against the code named in the
design's §0 (rail rule, agent CLI and notice write path, wake, Taskfleet
observation, Taskfleet 0.20.0 help and source). `git diff --check` clean; no
tests, since only issue documents changed.

Live check: no test-server behaviour changed. To see what the design starts
from, let an agent start a worker and reply "I'll report when it finishes":
the conversation shows under Sinun vuorosi as a new reply although nothing is
asked of you. Slice 1 of the design changes that.
