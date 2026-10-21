# History/auxiliary batch and final inventory

Partial slice 3 delivery; issue remains open. Native question answer/cancel,
integration OAuth/folder/attempt controls and Pi device/Claude subscription login
adapters still require implementation. The inventory reconciliation in
`issues/agent-cli/research.md` explicitly distinguishes these from implemented
commands and native git/gh/tmux/Taskfleet/file-tool workflows. No Fleetrepo change
is needed; live acceptance is conductor-owned after automatic main deployment.

## Delivered boundary

- History discovery includes own terminal/ended native Pi histories without
  starting Pi. Selected history uses the existing branch projection, owned-file
  reads and revision checks. JSONL history export walks before-pages itself;
  block export walks revision-bound byte/base64 chunks. Changing revisions,
  missing boundaries and cut-off tails remove the incomplete export.
- Receipt reads keep the original command ID and daemon-incarnation uncertainty:
  missing is not rejected, acknowledged is not turn completion.
- Process list/output/stop/finished-clear call the existing controller/child bridge.
  Output/stop keep both owner generation and the selected process token; finished
  clear keeps owner generation. Token mismatch never falls back to short ID.
  Failed/timed-out/not-found stops exit nonzero. Explicit native output remains
  sensitive user content, not a credential-redacted transcript.
- Attachments reuse native registration/read/quotas and no-follow reads. Browser
  and agent adapters share a single quota recount/write mutex. Download is binary
  file-only; uploads are bounded stdin/file. Referencing the returned ID in message
  text uses the existing attachment prompt adapter, not a second attachment store.
- Browser-local list/fetch share the existing bounded pending request/event/claim
  machinery with the Pi tool. They target a live own daemon conversation; agent
  routes cannot claim, complete or impersonate browser replies. JSONL lists walk
  offsets but do not promise a frozen browser directory snapshot.
- All new routes are behind own-kernel-UID admission and the separate default-deny
  agent table. No gateway/broker/session/editor/login-lease authority is borrowed.
  New wire shapes are canonical schemas with generated Go/TypeScript bindings.
  Existing history, process, receipt and attachment contracts are reused.

Exports are new private files, no overwrite; failure removes incomplete output.
Each JSONL record is one bounded native response, retaining completeness and safety
metadata, rather than losing owner tokens by flattening it. The bundled agent skill
contains query examples and the native-owner boundaries. Inline history is still a
bounded latest page; discovery/client/native bounds error rather than claiming an
unbounded successful export.

## Validation and limitations

Final test/review outcomes are recorded below before landing. All tests use
synthetic homes/accounts/credentials, not live user data. No full gate or live
provider/browser deployment check is claimed.

Whole-surface canon v4 review is recorded in `CONFORMANCE.md`. The runtime probe
runs the built binary as a fictional UID in a disposable networkless Ubuntu
container; the source/test judgment retains inherited partial sections rather
than copying the advisory probe's envelope-reading false positives as failures.
Known §8/11/12/15/17/18/19/23 limits are not promoted to a pass.

## Failure inventory

The first affected-package run found a nil-controller fixture panic caused by
constructing the history adapter eagerly. The adapter now defaults to the supplied
native config and uses controller native root only when available; focused tests
passed after repair. The first isolated canon wrapper used owner-only build/passwd
permissions, preventing the fictional UID from executing; permissions were fixed
and the probe rerun. A project-view validation during editing found this result
link before its file existed; the file is now present and final validation is run
after all documentation edits. Exploratory missing-path lookups were corrected
against the actual tree (ADR route filename, native block reader and examples
locations); no missing prerequisite was silently treated as executed evidence.

### Checks on this batch's final runnable tree

- `umask 077; TMPDIR=/var/tmp go test -race ./internal/cli ./internal/daemon
  ./internal/transport ./internal/contracts`: pass (CLI 8.245 s, daemon 83.989 s,
  transport 2.083 s; contracts has no Go tests).
- `./scripts/test-agent-uids.sh`: pass, including real owner/root/other/gateway
  UID admission/denial, permissive-mode peer rejection for all new route families,
  both activation paths/simultaneous activation, broker socket restoration.
  Combined race packages + UID script + contracts command completed in 235 s.
- `./scripts/test-focused.sh --area contracts`: pass; 63 schemas, 64 fixture
  files, 39 scenarios and 17 negative checks. Three new canonical families have
  examples and generated Go/TypeScript bindings.
- `./scripts/test-web-fast.sh`: pass after clean web dependency install; only
  generated contract bindings changed on the browser side. No production UI
  interaction changed, so no new Playwright claim is made.
- After updating the embedded agent skill, `go test -race ./internal/cli` and a
  fresh built-binary sandboxed canon probe both passed execution (12 s combined).
  The advisory probe reports ten gaps: eight runtime envelope/unsupported-doctor
  probe reports, the Rust-only layout report and repository front-door README
  suggestion. These are judged separately from the named real partial canon rows;
  no staged issue command was executed.
- Project-view validation passes after this result file was created. Final
  `issuectl doctor --json` and `git diff --check` are checked before commit;
  existing screenshot-size/format advisories are not introduced by this batch.


### Independent security review and assessment

`/llm-review` critical used `claude-fable-5-1` as finder (432 s) and
`gpt-6-astra` as independent verifier (39 s). One confirmed should-fix finding:
fetch timeout/upload-unconfirmed errors must say that an attachment may already
have arrived and forbid automatic replay. The native upload precedes browser
completion; reopening/sharing the folder cannot establish that no file landed.
The CLI now preserves that uncertainty, original code and exit status, with
`TestAgentLocalFileFetchPreservesUncertainty` covering both outcomes. No authority
or native operation was changed by this fix.

`/assess-findings` classified it CONFIRMED/OCCASIONAL/IMPROVES/NONE → FIX; applied
manually as part of this task. A second candidate about exporting one native
response record per JSONL line was dropped as a documented shape preference, not
a defect (count_unit records is explicit; native fences/completeness are retained).
Review and assessment artifacts are local `history/` working evidence; this result
carries the conclusion so no durable issue depends on an ignored report path.
No follow-up issue was filed. No unresolved security candidate remains; live
acceptance and the documented unfinished inventory remain outside the claim.

The finder's own broad daemon tests ran without the host's fixture/umask setup:
six native-source/unsafe-directory cases failed identically at HEAD in its
scratch baseline, and its distinct-UID case skipped. Those are not passing review
test evidence. The host's required umask-077 affected race suites and disposable
UID script passed; the message-only fix is followed by a final CLI race rerun.

Post-review validation: affected CLI race tests, rebuilt embedded skill/binary,
sandboxed canon probe, project-view validator, issue doctor and diff whitespace
check passed in 13 s combined after the uncertainty fix. Native daemon/transport
code did not change after the 235 s affected race/UID/contracts run.

Optional model-performance logging was attempted once through the prescribed
`assess-models.sh` helper. It exited 3 because SSH-to-self (`alder`) was denied
(`Permission denied (publickey,password)`, ssh exit 255). No corpus worktree or
credentials were changed and no alternate transport was improvised. Both required
model calls and assessment completed; only optional corpus publication is missing.
Synthetic test/review logs and scoring input are preserved under
`/var/tmp/open-habitat-agent-history-01m5f1wfbvx9c4bw3k761mwk2x/` on the worker host.
