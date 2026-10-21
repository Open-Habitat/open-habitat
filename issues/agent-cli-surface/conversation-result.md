# Partial delivery: conversation control batch

Taskfleet run `01m5ez9a96e4dqcq3xmw2bmzbe` delivers this independently landable batch. The issue remains open.

## Scope and limits

The personal CLI now controls explicitly named own conversations: live-handle list/create, full status, message send/steer/follow-up, native queue clear and daemon-held cancellation, continuation eligibility/resume, turn interruption, Pi stop, archive/restore with native revision and prior-state proof, empty-only close, title generation and native recap read/generation. Creation can select startup model/thinking or a browser worktree; it does not create a Taskfleet run. Message text is file/stdin-only and bounded.

The agent route table calls existing controller operations after the kernel own-UID check; it does not forward to the browser mux, change the browser trust predicate or grant gateway/broker authority. Archive uses the existing archive request and native snapshot revision token. Recap reads share the browser's native reader. Existing ownership, one-writer, freshness and empty-close checks remain in the shared operations. No credential operation, gateway route, persistence ledger, socket unit, packaging change or Fleetrepo change is added. No web code changed.

`conversation list` lists live controller handles only, including recovery of a lost create response within the daemon incarnation. Arbitrary native history discovery belongs to the later history batch. Explicit native IDs can already be inspected for archive, continuation and recap; terminal histories do not become controllable merely by naming them.

Writes never retry automatically. The caller-supplied message/control UUID maps to the controller's spent-command fence, not a durable replay ledger: a repeated spent ID is refused rather than sent twice. Create has no idempotent ledger; a lost reply requires inspecting the live list, not recreating. All conversation mutations explicitly reject dry-run as unsupported rather than claiming a reservation. Title/recap generation can take a bounded synchronous model call; a native `state: failed` is translated into a nonzero CLI exit, never successful completion. `CONFORMANCE.md` therefore retains partial §11/§12 status, alongside inherited shared-CLI partial rows; this is not whole-surface canon completion.

The bundled agent skill and structured drill-down help explain explicit targets, file input, state observation, queue cancellation, lifecycle operations, archive proofs, native history naming and uncertainty handling.

## Remaining batches

1. Workspace/repository/clone/worktree/Trash, preserving observation tokens and typed destruction; mark native git/gh/tmux/Taskfleet operations with reasons rather than wrapping them.
2. Integration and credential configuration with stdin/file-only secrets and redacted replies/logs.
3. Native history discovery/export, receipts, processes, attachments and browser-local file requests.
4. Whole-surface canon completion (including conversation retry/progress limitations), and live acceptance. No live-server acceptance is claimed here.

## Verification

Final checks and review are recorded below before landing. All native fixture commands use `TMPDIR=/var/tmp` and `umask 077`. No installed binary or Fleetrepo checkout was changed.

Tested runnable code is committed as `51ccbf85`; subsequent changes only record issue evidence. Commands and observations:

- `go test -race ./internal/cli ./internal/daemon ./internal/transport`: passed. Initial complete affected run **95.75 s** (daemon 85.644 s, CLI 8.244 s, transport 2.089 s); final run after the CLI encoding repair **9.43 s** (CLI 8.404 s; unchanged daemon/transport reused their passing package cache). Logs: `/var/tmp/oh-conversation-race.log`, `/var/tmp/oh-conversation-final-race.log`.
- `go test -race -v ./internal/daemon ./internal/cli -run '^TestAgentConversation|^TestAgentMessageEncodedLimit'`: all new cases explicitly passed without skips. The real agent listener works with the browser trust predicate set false, rejects gateway-only actions, identity hints and malformed queries/bodies, refuses spent sends, preserves nonempty history, checks archive freshness, resumes through native ownership proof, and closes only a separate empty child. Parser tests cover explicit targets, strict flags, opt-ins, model selection, nonzero generation failure, raw/encoded text limits and unsupported dry-run. Log: `/var/tmp/oh-conversation-final-focused.log`.
- Additional verbose `-race` run of existing continuation, queue-correlation, archive/unknown-writer, empty-close/terminal refusal, ownership-lock, native pinned-Pi recap persistence and title-concurrency cases: passed in **2.54 s**, no skips. This supplies native safety evidence independently of the thin route adapter. Log: `/var/tmp/oh-conversation-ownership.log`.
- `./scripts/test-agent-uids.sh`: passed in **80.73 s**. Every added action path is denied for root, gateway and another UID even with socket mode 0666; existing dual-socket activation and broker socket restoration tests also pass. It is disposable namespace/kernel-UID evidence, not installed-host or live-provider acceptance. Log: `/var/tmp/oh-conversation-uids.log`.
- `./scripts/test-focused.sh --area contracts`: generated bindings clean; **60 schemas, 61 fixtures, 39 scenarios, 17 negative checks** valid. Existing conversation-create/message/held/archive/recap protocols are reused; no new contract shape added. Log: `/var/tmp/oh-conversation-final-contracts.log`.
- `project-canon review --profile cli --run <worktree-local binary> --json .`: advisory completed, with manual canon-v4 review recorded in `CONFORMANCE.md`. The probe repeats its documented data-envelope, doctor-positional and Rust-layout false positives. Native conversation retry/progress limitations are explicitly partial, not a whole-surface pass. Log: `/var/tmp/oh-conversation-final-canon.json`.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and `git diff --check`: passed. SDK fixture dependencies were installed checkout-locally before daemon checks. No web suite, packaging test or full gate was needed/run.

## Independent security review and assessment

`/llm-review` critical scope: finder `claude-fable-5-1`, final verifier `gpt-6-astra`, two calls. The finder reported no security bypass, but found an actual raw/encoded message-size mismatch: JSON expansion could exceed the daemon's 66000-byte request limit even with <=65536 raw bytes. Local code inspection and the new regression reproduced it. The CLI now avoids unnecessary HTML escaping, checks the exact encoded body before connecting, preserves decoded text, and reports the dual limits. The verifier inspected the repaired final diff, traced those bytes into transport and ran the focused restrictive-umask tests without skips. It found no remaining defect at the own-UID/native safety/credential boundary.

`/assess-findings`: F1 **CONFIRMED / OCCASIONAL / IMPROVES / NONE / HIGH / FIX**, applied and retested. No residual issue filed. Review and assessment scratch: `history/review-agent-cli-conversations.md`, `history/assessment-agent-cli-conversations.{json,md}`. These ignored artifacts are supplementary; the substantive evidence is recorded here.

## Tool/sub-workflow inventory

All required implementation checks, review and assessment completed. Development fixture failures were corrected before the passing final runs: the initial listener fixture lacked its paired daemon socket path; the reusable fake Pi lacked the native clear-queue response shape; a prompt-count assertion originally counted explicit recap work as replay. The finder's own daemon tests hit restrictive-directory/fixture prerequisites under its environment; the local `umask 077` affected suite and the verifier's `umask 077` focused tests passed. These are recovered fixture/environment failures, not open product blockers.

Exploratory lookups used stale ADR/process-skill/queue-test/help-test names before reading the actual files. The installed issue skill lagged issuectl 0.21.0; its current bundled instructions were read through `skill print --agent pi` without changing installed tooling. The first print attempt used an unsupported positional name, and JSON parsing was retried as raw text because that print surface ignores the JSON flag. None changed product data or left a required step incomplete.

Optional model-performance corpus append failed once: SSH exit 255 (`alder: Permission denied (publickey,password)`), helper exit 3. No credential/configuration change or alternate corpus write was attempted. Product review, assessment and tests do not depend on corpus delivery. Log: `/var/tmp/oh-conversation-model-perf.log`. This is disclosed in the terminal report.

No Fleetrepo change is proposed. Live acceptance and remaining surface/canon work stay on this open issue, not silently claimed complete by this batch.
