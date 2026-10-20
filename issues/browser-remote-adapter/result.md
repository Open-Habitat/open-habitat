# Delivery result — 2026-10-20

Implemented against installed `fleetrepo-exec` **0.1.0**, source
`4f196cf057b55f9fef07d0be93567890a23701c6`, API envelope 1. Fleetrepo
`d8da1252` released the blocker. Its `issues/orx-background-runner/infra-ready.md`
was read fully and Jari's implementation/real-acceptance authorization was
recorded through issuectl before code changes and `preparation: ready`.
The previous preparation-only result is superseded, not a current restriction.

## Verification

- `TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-browser-focused.py -v`
  — **24 tests passed**, about 5 seconds; no npm installation, Go build, browser
  or SSH. Fake CLI scenarios cover structured argv, explicit untracked selection,
  missing dependencies/runner, transport errors, all terminal failure classes,
  nonterminal waits, unknown states, observer expiry, reconnect, bounded logs,
  outside-source fresh fetch targets and actual INT reaching cancel. They also
  exercise kernel-fact placement, forged context, private root-owned marker
  admission, one guest execution, npm no-spec and ci-local early refusal,
  and preserved unrelated local/Linux and focused-Go behavior (Go is fake).
- `bash -n scripts/test-focused.sh scripts/ci-local.sh` — passed.
- `python3 scripts/validate-project-view.py` — passed, 8 pages / 8 entries.
- `git diff --check` — passed.
- `issuectl doctor --json` — no metadata/schema/transition errors; existing
  attachment advisories remain unrelated.
- One focused source-grounded self-review; no model panels. The final fixtures
  were rerun after the small validation refinements. No heavy local web, Go,
  browser, packaging or full-gate run was performed on Alder.

## Real routed acceptance

The disposable closed copy started from product `966ed24f021ea0c7786ca42707acdf3f4cc8ba65`
and included the worker's adapter bytes, dirty tracked browser config and an
explicitly selected new `web/tests/hg-snapshot.spec.ts`. The reproducible
synthetic cases are retained in [acceptance.spec.ts](acceptance.spec.ts).
`.env.hg-denied` contained only an invented sentinel and was **not captured**.
The spec asserts the dirty config marker, absent denied file, Linux ARM64,
workers=2, port base 24000, the anonymous welcome UI and API/session 401s.

Shell entrypoint command (from the closed copy):

```sh
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 bash scripts/test-focused.sh \
  --area browser --spec hg-snapshot.spec.ts --writers-paused \
  --untracked web/tests/hg-snapshot.spec.ts \
  --idempotency-key oh-adapter-01m5c4f8gst5h9x1rq7jwrpht0-anonymous-2 \
  --wait-timeout 900
```

Job `52505bba098afb1207f1558df97125ed42328559d2fd5fae2be5cb7fd4bbdadb`:
**2 passed**, caller exit 0, terminal `success`; about 71 seconds total and
14.2 seconds Playwright. Raw responses: `/var/tmp/oh-browser-dffcm2o2`.

Final npm entrypoint, with the final runtime files:

```sh
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 npm run test:browser --prefix web -- \
  --spec hg-snapshot.spec.ts --writers-paused \
  --untracked web/tests/hg-snapshot.spec.ts \
  --idempotency-key oh-adapter-01m5c4f8gst5h9x1rq7jwrpht0-anonymous-final \
  --wait-timeout 900
```

Job **`992423b86a98bdb8c5e0a53dc4917eafefe499f9d0d8fcea7146aa35ef532b3d`**:
**2 passed**, caller exit 0, terminal `success`; about 69 seconds total and
14.0 seconds Playwright. Immutable input
`06f17f8dd8ec69c9ddd79b72a05b3981d717326232b8819f41e44feae371620e`
is recorded authoritatively in [acceptance.json](acceptance.json) together
with actual source/index identities, selected SHA256s, runtime/profile and
systemd result. Raw responses/artifacts: `/var/tmp/oh-browser-_mcx0781`;
closed source and before/after receipts: `/var/tmp/oh-adapter-acceptance.AlJibl`.
The two successful runs are complete independent job preparations, **not** a
controlled cold/warm benchmark or evidence of a speedup.

Fleetrepo's actual guest command was:
`/bin/bash scripts/test-focused.sh --area browser --spec hg-snapshot.spec.ts`.
Its worker prepared both captured dependency sets and Chromium before this
command; OH did not duplicate installation. Actual profile: native
Linux ARM64, Node **22.23.2**, Go **1.27.1**, Playwright **1.63.0**,
Chromium/headless-shell **1243** (153.0.8010.12), two workers and port base
24000. Toolchain/image profile SHA256
`a0ff3ab4b36834d52cb6108fe52ab4e584e3182191f69c98aec5c73c165b6817`.
Both private temp mounts were ext4; AF_UNIX bind succeeded. The retained
terminal systemd receipt has an **empty ControlGroup**. Fleetrepo owns the
3 GiB / 2 CPU / 512 pids / 900 s job limits and cross-submitter FIFO/lifecycle
proof; those mechanisms were not reimplemented in OH.

All **2484** captured files were compared to the caller after the final job;
bytes/link targets were unchanged. HEAD, Git status and the selected input
hashes also matched the before receipt. Guest test result, authoritative
terminal state and actual caller exit agreed. No source writeback occurred.
Then, as a separate deliberate staleness experiment, the closed copy's config
was edited and the maintained entrypoint reconnected to the **same** job:

```sh
./scripts/test-focused.sh --area browser --spec hg-snapshot.spec.ts \
  --job 992423b86a98bdb8c5e0a53dc4917eafefe499f9d0d8fcea7146aa35ef532b3d
```

It returned the original success with `stale: true`, made **no create call**,
and fetched to a fresh `/var/tmp/oh-browser-fi927bj0` directory. Source was
never overwritten to hide staleness.

## Failures retained, not relabelled

The first real routed attempt, job
`de004518622f5c4bf27e1e75d2963f7f3401db4df9848968a612f97a9e6825ae`,
returned `test-exit` and caller exit **1** after about 55 seconds. Guest exit
was 2: reading `/opt/hb-exec/installed.json` failed with `Permission denied`.
Runner 0.1.0 installs a root-readable-only receipt; root ownership/mode can be
checked without reading it. The adapter now validates the installed marker's
actual inode/ancestors, readable root-owned task metadata, Linux ARM64, UID
name, exact source path and real job cgroup. It does **not** weaken Alder's
remote-only policy. Failed evidence remains at `/var/tmp/oh-browser-6nurdhyu`;
two later genuinely new snapshots passed. No Fleetrepo transport/service was
changed or bypassed.

An initial cheap fixture run had 20/21 passing: the fake CLI's call counter
persisted between transport-failure subcases and skipped the intended wait
failure. Resetting fixture state made the failure scenario execute; final
coverage is 24/24. A mismatched documentation edit and two exploratory reads
of incorrect Fleetrepo source paths were corrected without changing unrelated
files or treating missing reads as evidence.

Fleetrepo already supplied the native credential receipt, job
`dcad3baebc8523a6f4e2f36405984f8c7a3ade1ffe43d58e159eeb69a9a78a3b`:
**11 passed, 1 failed**, state `test-exit`, native synthetic key add/provider
switch/removal **passed**. The remaining assertion at
`account-settings.spec.ts:345` expects textbox `Viesti Pi:lle`, which is absent.
This is **not a green suite**, not an adapter/infra blocker, and no assertion
was weakened or deleted. The credential suite was not redundantly rerun.
Its authoritative evidence is Fleetrepo
`issues/orx-background-runner/live-infra-evidence.json` at `d8da1252`.

## Limits and handoff

The delivered scope is one ordinary focused spec, no tags or lab/full/no-spec
routing on Alder. Full-gate preflight refuses **before** heavy setup; a missing
runner/network does not permit fallback. Normal unrelated Linux CI/developer
hosts keep their local paths. Cooperating writers must pause until synchronous
capture returns; arbitrary outside writers are not locked. INT/TERM explicitly
cancel; observer expiry/HUP/crash does not imply completion. Keep the printed
job ID and reconnect rather than resubmit.

No clean-gate receipt, amd64 release or distinct-UID isolation claim. The parent
owns pushing OH main and any disposable test-server publication. No deployment,
Fleetrepo installation, global skill refresh or unrelated service change was
performed by this worker.
