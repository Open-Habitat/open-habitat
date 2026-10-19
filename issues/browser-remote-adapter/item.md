---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: open
priority: normal
preparation: pending
lane: gate-health
lane_seq: 4
collision: [gate]
---

# Route focused browser checks through the shared remote runner

## Goal

Route the maintained focused browser command through Fleetrepo's shared heavy-execution runner, moving dependency preparation, web build, Go fixture, Vite and Chromium together into Cedar's bounded Linux ARM64 guest. Alder retains source, editing and merge authority.

## Agreed next action and external blocker

Jari authorized preparation only on 2026-10-19. Preparation is complete in [result.md](result.md); the bounded implementation plan is below. **Do not implement or launch the adapter yet.** Fleetrepo must first supply its version-bound infra-ready evidence and real installed runner CLI/task schema, as specified in Fleetrepo `docs/decisions/0016-alder-cedar-heavy-execution.md` and `issues/orx-background-runner/open-habitat-pilot-brief.md`. Then record authorization of the concrete adapter action and change `preparation` to `ready`.

This issue is scheduled in `gate-health` with collision token `gate`; `preparation: pending` deliberately prevents a fresh worker. The external blocker is Fleetrepo @orx-background-runner, not a fabricated same-repo dependency. Do not set `ready` just because SSH works or a guest exists. No TODO.md changes or other conductor's work are part of this preparation.

## Implementation plan (after release of the blocker)

1. Bind one OH task definition to the actual runner schema/version. Its public input is one existing ordinary `web/tests/<name>.spec.ts` plus optional `--tag`, following the current focused script's filename and tag validation. Reject missing spec, `lab-*`, unsupported config/full-suite/CLI options rather than broadening this pilot. Keep task argv structured, never interpolate a tag into shell. Task cwd is the captured repo root.
2. Dispatch `scripts/test-focused.sh --area browser` after cheap input validation but **before** checking local `web/node_modules/.bin/playwright`. Preserve web/go/contracts branches. Change the maintained npm `test:browser` entrypoint to the same dispatcher: accept its documented focused form, or explicitly refuse unsupported full-suite calls during the pilot; never execute a heavy local fallback on Alder. Update TESTING.md with this temporary scope restriction. Keep `scripts/ci-local.sh` outside pilot routing: it currently calls `test:browser` for a full suite, so it must explicitly refuse unsupported remote scope, not silently claim a clean gate. Expanding to full gate needs later work.
3. Provide a distinct guest-internal local executor using the same validated spec/tag. Use the real runner's execution context and host policy for authorization. A user-set recursion environment flag is insufficient permission for local execution on Alder. `remote-required` fails closed on absent runner, bad context, connection failure or admission refusal. Budgeted explicit local mode is unavailable until Fleetrepo provides that budget. No SSH, snapshot engine, job queue or Taskfleet lifecycle code in OH.
4. Declare source inputs: tracked source/build/config/contracts/design-system assets, root Go manifests, web manifests/lock and tests/fixtures, plus explicitly chosen untracked inputs. Also include tracked `internal/daemon/pi-device-test/package{,-lock}.json` and native fixture helpers. Exclude `.git`, `.env*`, credentials, `.tools`, `.cache`, `node_modules`, dist and prior results. Fleetrepo captures/verifies immutable input and source staleness; OH does not implement capture. Need source-owner cooperation during capture even in an actively edited worktree.
5. Inside the assigned job/cgroup, install `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund` from their captured locks. The latter is required for native-credential browser journeys, although the proposed anonymous login smoke does not exercise it. Use guest native Go 1.27.1 and Node 22.23.2, runner-provisioned Playwright 1.63.0 Chromium/cache and libraries. Do not run amd64-only `bootstrap-tools.sh`, import `.tools`, or run the full gate. Leave `OH_WEB_PREBUILT` unset; globalSetup must build this input's assets and host.
6. Address fixture storage with Fleetrepo: `os.MkdirTemp("/tmp", ...)` and teardown's `/tmp/oh-browser-[0-9]+` allowlist currently ignore TMPDIR. Either Fleetrepo demonstrates private bounded disk-backed guest `/tmp`, or make a coordinated small OH change to use a short private disk-backed temp root and safely constrain marker cleanup to that root/current UID. Do not simply loosen the deletion regex or choose a long socket path. No code change in this preparation.
7. Runner profile enforces at most two browser workers (overriding submitter `OH_BROWSER_WORKERS=8`), reserved port range (`OH_PORT_BASE`, e.g. 14000), sanitized synthetic HOME, short disk-backed TMPDIR, browser/cache paths and toolchain. No inherited agent credentials, SSH agent, real home, Vite build flags or `OH_WEB_PREBUILT`. Installation/build/test remain within one granted slot and cgroup. Cgroup ownership, deadlines and full descendant cancellation are Fleetrepo's responsibility.
8. Surface job/attempt ID, immutable input identity, platform/profile, queue reason, bounded logs and terminal result; reconnect queries the same job, not a resubmit. Fetch only capped artifacts into a new runner result directory. Show stale source without overwriting it. Preserve test failure exit; timeout/OOM/cancel/interrupted/unknown/transport failure cannot become success. No clean-gate receipt, amd64 release proof or distinct-UID claim.

## Validation after implementation

Cheap adapter tests use a fake runner (no browser): valid spec/tag forwarded as exact argv; bad/path-traversing/missing/lab specs and unsupported options refused; no-spec npm full suite fails clearly; dispatch needs no Alder npm install; other focused areas unchanged; guest invocation executes once; forged guard cannot authorize Alder local execution; remote failures never fall back; cancel/timeout/unknown are non-success; snapshot/result metadata is surfaced and result fetch never overwrites source. Avoid tests that just duplicate the script's strings.

After infra-ready, use the brief's disposable-clone dirty-config + explicitly selected untracked `hg-snapshot.spec.ts` + denied `.env.hg-denied` experiment. Record two real Chromium cases against the Go fixture in Linux ARM64, worker cap, input hashes, exact versions/image/browser revision and empty terminal cgroup. Also exercise one existing credential-backed spec with its native fixture dependency installed, not just the anonymous smoke. Fleetrepo supplies cross-repo one-slot, disconnect/restart/idempotency/cancel/quota evidence; OH references those receipts rather than reimplements the guarantees. Compare cold/warm timings without promising speedup.

## Acceptance Criteria

- [ ] Fleetrepo infra-ready evidence, actual runner schema/version and concrete adapter authorization recorded before implementation.
- [ ] Focused script and maintained npm browser entrypoint route or refuse clearly; no heavy Alder fallback or recursive resubmission.
- [ ] Whole workload including dependency installation/build/fixture/browser executes under guest limits; ARM64 native dependencies and temp storage verified.
- [ ] Small adapter failure-boundary tests pass and one dirty-snapshot real ARM64 smoke plus a credential-backed focused spec have receipts.
- [ ] Results identify immutable source/platform, stale source and non-success classes correctly; no source writeback or clean-gate/amd64/UID-isolation claim.

## Out of scope

Guest provisioning, inference capacity, shared transport/capture/FIFO/durability/systemd implementation, full-suite or lab routing, full-gate receipt redesign, amd64 packaging, distinct-UID isolation and Taskfleet placement/merge changes. Fleetrepo owns the first group; later OH work owns any expansion beyond focused ordinary specs.
