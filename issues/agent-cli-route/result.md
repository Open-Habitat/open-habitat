# Product slice and remaining live acceptance

The product side of ADR 0027 slice 1 is implemented. The issue remains open:
Fleetrepo must install and gate the second socket before this binary can start
on the test server, then live Pi/plain-shell/quota acceptance must run.
No Fleetrepo files or test-server services were changed by this worker.

## What is available to try

`open-habitat agent environment show --json`, `agent workspace list --json`
(and `--output FILE.jsonl`), and `agent conversation show --current --json`.
An explicit `pi:UUID` reads a record held by the current daemon controller;
it does not enumerate arbitrary terminal history. `skill print agent` explains
context inheritance and the read-only scope. The CLI and daemon builds are
reported separately. Unavailable quota is never zero or unlimited; filesystem
capacity is a separate observation.

The root-owned agent endpoint is private to the person's UID, not an alternate
gateway principal. Its route table never dispatches into the browser mux. Both
systemd descriptors are required and validated. A nonce-addressed startup probe
preserves owner requests without reading their bytes, including the activating
request. Broker readiness/boot starts now require both verified socket inodes;
the agent socket is restored through the same ordered root policy gate, without
a new broker protocol. Temporary native title workers receive no current-context
claim; only create, continuation and held-message restarts supply one.

The shared CLI now has text and structured drill-down help and exit documentation,
bare personal `config path/show` and `doctor` with nonzero failures, and the
agent skill in all three native runtime layouts. `CONFORMANCE.md` records the
manual canon assessment and inherited partial requirements rather than claiming
complete CLI conformance. The two stale deferral references were historical
review-run outcomes, not current blockers; their text is now explicit about that.

## Fleetrepo change required before release/start

1. Install the product's `open-habitat-agent@.socket` beside the updated daemon
   service/socket templates. It listens at
   `/run/open-habitat/users/<name>/agent.sock`, private owner:owner **0600**,
   `DirectoryMode=0710`, descriptor name `agent`, explicitly targeting
   `open-habitat-daemon@<name>.service`. The daemon service Requires+After both
   socket instances. Keep the gateway socket owner:gateway 0660.
2. Add the same per-instance root policy-gate Requires+After drop-in to **both**
   socket units (`open-habitat-jit-policy-gate@<name>.service`). Neither an
   instance nor a service dependency may bypass the activation-phase gate.
   Preserve root-owned, non-owner-writable parent directories and existing
   named search ACLs; never grant another UID agent-socket access.
3. Update installation/preflight/upgrade and reboot restoration inventories to
   prepare and verify both listeners for every committed admitted account,
   including existing accounts. Do not enable individual instances independently
   of the broker. The product executor now checks effective agent SocketMode,
   DirectoryMode, SocketUser/Group, RemoveOnStop, FileDescriptorName, **Triggers**
   (systemd's effective target property) and Listen. The expected trigger is the
   matching daemon service and the only listener is the exact Unix path.
4. Install templates and site drop-ins before switching to the two-descriptor
   binary. Restore both sockets before any syncing user's boot service start.
   The product's `RouteReady` refuses a missing, inactive or unsafe second socket;
   an old one-socket installation deliberately fails closed, not degraded.
5. On the disposable test server, cold-trigger from each socket and concurrently;
   verify the first queued response, unit ordering, correct peer rejection and
   pathname permissions. From a native daemon-launched Pi child, verify current
   context and stale descendants after restart. From a plain shell as that UID,
   verify environment/workspace reads, unavailable current context, and explicit
   IDs. Prove `storagequota.Read` succeeds under the installed daemon's confinement
   with real nonzero byte limits and enforcement, not just filesystem free space.
   If own-user quota observation is unavailable, keep the issue open and diagnose
   that concrete kernel/confinement result rather than adding a privileged helper.

The synthetic cold proof exercises real distinct UIDs, real inherited named
socket descriptors and production startup validation, but it is not PID 1 or a
live installed-host quota proof. The ADR remains while this acceptance and the
later approved slices are unfinished; durable authority rules are already in
`internal/AGENTS.md`.

## Independent review and assessment

Required critical `/llm-review`: finder `claude-fable-5-1`, verifier
`gpt-6-astra`, two completed calls, followed by `/assess-findings`.

- **Confirmed and fixed:** temporary native title workers for terminal-created
  histories had no browser-origin record, so deriving launch context from the
  owner lock would reject them. Context is now an explicit launch argument;
  create/resume/held supply it, auxiliary title workers do not. An actual child
  regression proves an unmarked owner launches without inheriting forged
  context. Native Pi fixtures also exercise the revised launch seam.
- **Confirmed, very low impact, fixed for clearer lock lifetime:** conversation
  reply I/O initially remained inside the controller mutex. The handler now
  copies scalar fields under lock and writes after unlocking.
- **Dropped:** the finder mentioned an obsolete single-FD helper that had already
  been removed while review was in flight. Paired envelope/type regressions
  retain its relevant negative coverage.

The verifier independently inspected both fixes, current peer/generation fences,
paired provisioning readiness, and strict package socket inventories; no
confirmed residual security finding remained. No review issue was filed.
The gitignored local review and assessment live at
`history/review-agent-cli-route.md` and
`history/assessment-agent-cli-route.{json,md}`; this section contains the durable
finding/evidence record without depending on those scratch files.

## Verification and failure inventory

All tests use synthetic homes, identities and credentials. No full gate or live
deployment was run. On Linux builds use disk-backed `TMPDIR=/var/tmp` and native
fixtures require `umask 077`.

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` and
  `npm ci --prefix web`: passed.
- `umask 077; TMPDIR=/var/tmp go test -race ./internal/cli ./internal/daemon
  ./internal/transport ./internal/udssecure ./internal/storagequota
  ./internal/core ./internal/gateway ./internal/provision`: passed. The first
  final post-review run took **79.04 s**, before the last missing-current-record
  stale classification regression; the final rerun is recorded below.
- `scripts/test-agent-uids.sh`: passed, **26.73 s** including compiled fixtures.
  Actual owner/gateway queued requests survive production two-descriptor
  validation when cold-triggered from agent, daemon, or both. Namespace-root,
  gateway and another UID cannot reach the agent handler even at mode 0666.
  Gateway-only routes are absent. The broker refuses a service start with a
  missing/inactive/unsafe agent socket, then accepts the safe active pair.
- `scripts/test-broker-boot-uids.sh`: passed, **1.51 s**; existing distinct-UID
  boot-signal/linger behavior remains covered.
- `go vet` on cli, daemon, transport, udssecure and provision: passed.
- `scripts/test-focused.sh --area contracts`: passed, **0.49 s**, 59 schemas,
  59 fixture files, 38 scenarios and 17 negative checks; generated Go/TS clean.
- `scripts/test-web-fast.sh`: passed; first timed run **24.81 s**. Only generated
  web contract fingerprints/types changed, no UI behavior. Production web build
  also passed.
- `scripts/package-release.sh` with synthetic version `0.0.0-agent-route`,
  `verify-release.sh`, and `test-package-socket.sh`: passed. These are smoke
  archives of the working source, not a published release. Re-signed agent socket
  mode/service-target/dependency mutations are rejected, along with the existing
  unsafe package regressions.
- `project-canon review --profile cli --run .cache/agent-route-open-habitat --json .`
  and `/cli-canon`: completed. The mechanical tool's top-level-vs-data envelope
  assumptions are false positives for help/version/skill fields; its `doctor .`
  probe is invalid syntax. The §24 unresolved-reference finding is gone. Manual
  section-by-section evidence and genuine inherited partial requirements are in
  `CONFORMANCE.md`; this is not a claim that every operator command meets every
  canon rule. No staged issue-creation commands were executed.
- `validate-project-view.py`, `issuectl doctor --json`, `git diff --check`:
  passed during finishing; rerun after final documentation below.

Failures encountered and resolved: the first contract run used an invalid
scenario ID (`CT-AGENT-001`), corrected to the canonical numbered `CT-040`.
The first race run inherited umask 0002, causing synthetic credential/runtime/
checkout permission failures; using 077 resolved them. The next run exposed two
native Pi fixtures without a launch origin; fixtures and the subsequent explicit
launch-context fix now cover them. A transient compile failed after removing the
obsolete activation helper because its old test import remained; that import was
removed and replacement descriptor-type tests pass. Optional exploratory `cat`
lookups of guessed Go file paths failed; scoped symbol searches found the real
files, with no skipped implementation or test obligation. A `jq .data` query of
project-canon's flat output failed; querying its documented flat fields and manual
`.data` inspection of the product output resolved the evidence mismatch.

**One optional workflow remains failed:** model-performance corpus logging tried
once through the installed helper and returned exit 3: SSH to alder was denied
(publickey/password), underlying SSH exit 255. Both independent reviews completed;
only the non-product score write is unlogged. Error is in
`/var/tmp/agent-route-model-log.err`; no credential, SSH, corpus or Fleetrepo state
was changed to work around it. Required product tests/reviews are not waived.
Live acceptance is explicitly waiting for the Fleetrepo change above, as permitted
by the worker brief, not reported as a test pass.

Final unchanged-code reruns: all eight affected Go packages with `-race` passed
in **87.43 s** (`/var/tmp/agent-route-final-stale-race.log`); the expanded
cold/peer/broker UID proof passed in **17.04 s**
(`/var/tmp/agent-route-final-uid.log`). The final source's smoke archive was
rebuilt and verified, and every unsafe-package mutation test passed
(`/var/tmp/agent-route-final-package.log`). The final project-view, issue doctor
and whitespace checks passed. Both review calls completed; the optional corpus
write is the only unresolved tool/sub-workflow failure.

**Release coordination:** do not let an automatic release watcher switch this
binary onto the current one-socket installation before Fleetrepo has installed
and verified the paired units and site gates. The product intentionally refuses
to start with one descriptor. Coordinate the Fleetrepo change with the release,
then complete the live checklist rather than closing the issue from unit tests.

## Installed-host acceptance (2026-10-21)

Fleetrepo installed and gated the paired daemon and agent sockets (Fleetrepo
19a739c4; receipt `issues/native-agent-hetzner-runtime-apply/agent-socket-result.md`
and `agent-socket-live.json` there). The test server ran pilot.287 (product
67a7866c, a documentation-only descendant of 3e10991c). Cold first replies via the
agent socket, the daemon socket and both: 0.258 / 0.245 / 0.237 s. A daemon-launched
native Pi session ran `agent environment show`, `agent workspace list` and
`agent conversation show --current`; a plain shell of the same user gets
`current_context_unavailable` and succeeds with an explicit ID; an independent child
after a daemon restart gets `current_context_stale`. Confined own-UID quota read:
available and enforced, 8 GiB hard limit, nonzero usage. Both mapped users have active
paired listeners; no failed system unit. No provider turn or browser UI acceptance
is claimed.
