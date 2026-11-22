# Design result

Prepared [design.md](design.md) for Jari's decision. No product, contract,
service or harness code changed. The issue remains open with
`preparation: pending`; implementation is not authorized by this result.

The proposal compares three approaches and recommends a five-minute,
operator-owned countdown, a typed host announcement delivered through each
user's daemon/companion and supported native worker adapter, and no automatic
extension for a person's active turn. It distinguishes browser notices from
model steering, timed wakes from post-upgrade continuation, and daemon-owned
processes from surviving native workers. It includes failure/recovery behavior,
receiver rollout, browser behavior and four approval questions.

## Decisions for later review

- **Five-minute lead, no automatic active-turn extension.** Alternatives are a
  longer default or a bounded human-turn grace. A fixed deadline removes the
  indefinite wait while leaving time to save a checkpoint; the duration is a
  proposed product choice, not measured evidence.
- **Host-owned advisory with per-user consumers.** Alternatives are deployment
  scripts calling notices or an agent-readiness coordinator. Existing notices
  do not prompt the model, and readiness cannot guarantee safe interruption.
  The new advisory/adapter architecture is explicitly awaiting approval; no
  listener permission or authority was changed.
- **Receiver-first rollout and explicit unsupported-worker coverage.** A new
  release cannot equip already running predecessors or unsupported harnesses
  retroactively. Prefer honest limited coverage over terminal injection or
  fake delivery claims; supported Taskfleet Pi integration still needs work.
- **Optional resume checks, not universal automatic continuation.** Existing
  wakes are timed and require a daemon launch context. A wake two minutes after
  cutover is only a check of upgrade completion; an outage can delay/fail it.
  Gate scheduled-wake delivery during cutover rather than claiming the current
  wake machinery already understands upgrade generations.
- **One product scheduling path for deployment callers.** An operator's deployment tooling, a test
  watcher or a release-cut deployment should authorize and invoke the same
  host path. Their external implementations were not inspected, so the design
  does not assert how they currently poll or wait.

## Review and verification

Source baseline: `18c67cfada2cf1f2a2e1f69d62369851766410ae`; final change scope is
this issue's design, result and preparation metadata only.

Review chosen: source-grounded self-review of the design and final diff,
including native notice persistence, busy-wake refusal, shutdown, work census,
upgrade approval/fencing and worker ownership. No independent LLM review was
run: this deliverable changes no sessions, contracts, daemon state or
implemented authorization boundary. Architectural proposals remain questions
for Jari, not approved changes. Future implementation needs independent review
and the native/UID evidence listed in the design.

Checks (under `umask 077`, validators under the shared scratch lease):

- `timeout 60s ... python3 scripts/validate-project-view.py` — passed, 14 pages.
- `timeout 60s ... issuectl doctor --json` — passed, no findings or warnings.
- `git diff --check` — passed (including final staged additions).

No Go/browser/full-gate tests, live upgrade, native model delivery or external
deployment-policy verification were run: this is a documentation-only proposal,
not runtime acceptance. No deployment occurred and no private test-server
try-it entry was needed. No new issues were filed.
