# Full-scope shared execution consumer

Source implementation, **not live full-suite acceptance**. The issue remains
untriaged/unlaned; no earlier pilot issue was reopened or closed. Parent owns
main publication, runner upgrade, convergence and test deployment.

## Implemented

Ordinary browser/no-spec, complete lab, focused spec/tag, ordinary npm web
checks/builds/Storybook, focused web/Go/contracts and ci-local dispatch named
repository tasks before local heavy prerequisites on Alder. Guest commands
verify kernel/root metadata and run within the existing slot, without recursive
submission. The foreground capture acknowledges cooperating-writer pause;
untracked files still require explicit selection. FIFO/capture/Git/SSH/caches/
quotas remain entirely in Fleetrepo.

The guest gate uses the root-installed ARM issuectl 0.19.0, preserves private
HOME/cache paths, bounds Go compilation/runtime and browser/Vitest workers,
prepares both npm dependency sets once, and serializes browser versus Go heavy
phases. Browser failure is still reported after Go/contracts completes. It
exports ARM-native test health with real source identity/cleanliness, not the
native amd64 production receipt. Native packaging/reproducibility/archive/socket
checks remain in the existing native CI path. `oh-build-amd64` exports a real
CGO-disabled Go cross-build with explicit output target, never an ARM binary
presented as x86 or an x86 execution claim. Fetch never writes back to source.

Self-review checked command preservation, task runtimes/outputs, literal argv,
root/task/cgroup admission, clean versus dirty receipt attribution, failure and
signal behavior, compiler concurrency and native release-gate separation. Found
and corrected before delivery: contract drift must be checked *before*
regeneration; focused Go must preserve its default package scope; and guest
browser/Vitest worker limits must be explicit final argv, not just overridable
environment defaults.

## Cheap evidence

No npm installs, Go compilation, browser or SSH ran on Alder.

```sh
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-browser-focused.py -v
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-gate-receipt.py
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-browser-hosts.py
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate-project-view.py
bash -n scripts/ci-local.sh scripts/runner-area.sh scripts/test-focused.sh scripts/test-web-fast.sh scripts/web-build.sh
git diff --check
issuectl doctor --json
```

31 adapter tests, including hermetic ordinary/lab/tag/web/Go/contracts/gate
routing, no local prerequisites/fallback, native Linux preservation, terminal
failure classes, literal argument forwarding/rejection, signal cancellation,
durable resume, root-declared guest identity, real clean/dirty Git attribution,
and stubbed guest gate ordering/cache/dependency/failure behavior. The stubs
are orchestration evidence only, not actual application test health.

All 18 declarations additionally validated against the actual Fleetrepo 0.2
`hbexec.tasks.resolve` and `phases` implementation from its source, with every
phase cwd checked. Local logs: `/var/tmp/oh-offload-{tests,receipts,hosts}.log`,
`/var/tmp/oh-offload-doctor.json`.

Two early guest-orchestration test-fixture attempts failed: the fixture lacked
`/opt/hb-exec/bin/issuectl`, then its fake interpreter suppressed the native
fixture's JSONL generation. Corrected the disposable fixture's tool path and
stdin execution; no production assertion was relaxed. An initial process-skill
read used the wrong path and was recovered by reading its advertised npm path.
No review/panel/delegated workflow was requested or claimed.

## Parent continuation — actual remote proofs NOT RUN

`fleetrepo-exec version --json` still reports installed **0.1.0**, commit
`4f196cf057b55f9fef07d0be93567890a23701c6`. No full-scope job was submitted to
that incompatible profile. No live job IDs or green CI/application claim exists.
The brief explicitly permits staging this acceptance for the parent's upgrade.

After main-only 0.2 installation, in a dedicated committed clean OH checkout,
run these exact ordinary entrypoints (keep writers paused until capture returns):

```sh
fleetrepo-exec version --json
fleetrepo-exec doctor --json
npm run test:browser --prefix web -- --idempotency-key oh-full-ordinary-01m5ce8pjvq2k8x4v2f1dvkdn8
npm run test:browser:lab --prefix web -- --idempotency-key oh-full-lab-01m5ce8pjvq2k8x4v2f1dvkdn8
./scripts/ci-local.sh --clean --no-reuse --json --idempotency-key oh-full-gate-01m5ce8pjvq2k8x4v2f1dvkdn8
python3 scripts/browser-focused.py --task oh-build-amd64 --idempotency-key oh-amd64-output-01m5ce8pjvq2k8x4v2f1dvkdn8
```

Observe existing attempts with `python3 scripts/browser-focused.py --task TASK
--job JOB_ID`; never recapture under a new key after ambiguous acknowledgement.
Each command prints durable job/evidence paths and fetches root receipt and
artifact archive outside source. Inspect root `source_git` (original HEAD,
tree, staged/index and dirty state), guest platform/target/ELF metadata and
captured source staleness. Preserve any real account-settings or other assertion
failure as `test-exit`, not infrastructure failure or green CI. A failed gate
never emits passed ARM health. The full native amd64 production gate remains
separate and still required where production release acceptance is claimed.

Host deployment operators expecting builds to appear back in the checkout must
consume fetched exports instead; this worker intentionally did not alter the
Fleetrepo release watcher/operator or install remote outputs locally.
