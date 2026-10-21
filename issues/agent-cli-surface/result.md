# Partial delivery: global defaults and conversation controls

The conversation-control batch is recorded in [its result](conversation-result.md). This page retains the earlier global-defaults evidence.

Run `01m5eyk4qb9zs4fxk0nj84nrnp` implements the independently landable global-defaults batch of slice 3. The issue remains open.

- `agent model list` reads the native Pi catalog and current global provider/model/thinking defaults without starting a conversation.
- `agent model update --provider PROVIDER --model MODEL [--thinking LEVEL]` uses the same native model operation as the browser. The provider/model pair is explicit; omitted thinking and unrelated Pi settings are preserved. Repeating a selection is convergent. Unknown/unavailable models and unsupported thinking return fixed actionable codes; native failures remain uncertain, not proof of no write.
- Dry-run returns `dry_run_unsupported`; it does not fabricate a settings/catalog reservation.
- Git identity is marked **native**, not wrapped: `git config --global user.name` and `git config --global user.email` already read/write the authoritative config, including Git's native precedence and includes. The bundled agent skill documents this and the model-default workflow.
- Only `/agent/v1/models` GET/POST was added. It uses the existing own-UID listener and separate default-deny route table; no gateway peer capability, broker operation, credential write or new persistence layer was added. Browser model operations share the native implementation, not authentication. Existing conversation ownership, one-writer, observation-token and typed-delete checks are untouched.
- Existing `pi-model-update` and `pi-models` contracts are reused. No new socket, service, packaging input or Fleetrepo change is needed for this batch. No web code changed.

## Remaining batches

1. Workspace/repository/clone/worktree/Trash operations, preserving observation tokens and typed destruction. Mark native operations with reasons instead of wrapping git/gh/tmux/Taskfleet.
2. Integration and credential configuration with stdin/file-only secret input and redacted output/logging.
3. History, receipts, processes, attachments and browser-local file requests.
4. Whole-surface canon completion and live acceptance after the remaining batches. This batch's synthetic tests are not live-server acceptance.

## Verification

All native fixture commands used `TMPDIR=/var/tmp` and `umask 077`. Tested product revision: `928f2f43` (the preceding feature commit; all final runnable changes were present for the checks below). The following evidence commit changes only the issue body/result.

- `go test -race ./internal/cli ./internal/daemon ./internal/transport`: passed in **93.02 s** (daemon 80.591 s, CLI 8.211 s; unchanged transport reused its passing package cache). Log: `/var/tmp/oh-agent-model-final-race.log`.
- `go test -race -v ./internal/daemon -run '^TestAgentModels'` and the matching CLI `'^TestAgentModel'` run: all new tests explicitly passed, no skips. Native listener tests prove read-only catalog behavior, native read-back, repeatable update, preservation of unrelated/omitted settings, fixed model/thinking rejection without writes, malformed-body/query denial, browser route absence and credential-sentinel exclusion. Log: `/var/tmp/oh-agent-model-verbose.log`.
- `./scripts/test-agent-uids.sh`: passed in **23.27 s**, including new models-path rejection for root, gateway and other UID even with socket mode 0666. Existing dual-socket cold activation and broker restoration tests also passed. Log: `/var/tmp/oh-agent-model-final-uids.log`.
- `./scripts/test-focused.sh --area contracts`: generated code clean; 60 schemas, 61 fixtures, 39 scenarios and 17 negative checks valid. Existing model contracts reused. Log: `/var/tmp/oh-agent-model-final-contracts.log`.
- `project-canon review --profile cli --run <worktree-local binary> --json .`: completed; manual canon-v4 review of the added model surface passes validation, noun/verb, selective update, repeatability, explicit unsupported dry-run, bounded catalog, structured help and native-store rules. `CONFORMANCE.md` records the evidence. The probe repeats its known envelope-reading false positives and Rust-only layout assumption; the shared CLI still has the already-recorded partial rows (§8, §12, §15, §17–19, §23). This is **not** a whole-surface conformance pass. Log: `/var/tmp/oh-agent-model-final-canon.json`.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check`: passed. No web changes, web test or full gate. No installed binary changed.

## Independent security review and assessment

`/llm-review`, critical security scope: finder `claude-fable-5-1`, verifier `gpt-6-astra`, two calls. The finder identified caller errors wrongly collapsed into system failure and conversation-specific advice on model errors. Both were repaired; the final verifier inspected the repaired diff and confirmed there is no remaining reachable defect at the specified own-UID/authority/credential boundary. `/assess-findings` classified both original findings CONFIRMED / OCCASIONAL / IMPROVES / FIX; both are resolved. No review issues filed.

The verifier also ran focused CLI/daemon/transport and diagnostics-redaction tests with restrictive umask. Its local distinct-UID tests skipped; the separate namespace script above supplies that evidence. Neither model's result substitutes for kernel-UID testing. Local scratch reports: `history/review-agent-cli-models.md` and `history/assessment-agent-cli-models.{json,md}`; substantive evidence is recorded here so those ignored artifacts are not required later.

## Tool/sub-workflow inventory

All required batch tests and both review calls completed. Finder's first test hit the documented permissive-umask credential-directory failure, then passed with `umask 077`. Initial documentation/helper lookups used stale filenames; corrected to the existing ADR, `notices_linux.go` and installed process-skill paths. An advisory-JSON query initially assumed a `data` envelope; corrected to project-canon's actual top-level shape. These were recovered lookup/probe errors, not outstanding verification failures.

Optional model-performance corpus append failed with SSH exit 255 (`alder: Permission denied (publickey,password)`), helper exit 3. One attempt; no alternate corpus write or tooling/configuration changes made. Review and assessment artifacts remain available; product verification does not depend on corpus delivery. Log: `/var/tmp/oh-agent-model-perf.log`.

Live-server acceptance and the remaining batches are not run or claimed. No Fleetrepo change is proposed for this batch.
