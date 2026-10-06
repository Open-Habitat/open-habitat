# In-repository Open Habitat rename

The repository now builds `github.com/Open-Habitat/open-habitat`, `cmd/open-habitat`, the `open-habitat` release archive and `open-habitat-web` package. The web title, CLI, neutral units, account names, sockets, contracts, current documentation and development tooling use Open Habitat. Browser listener isolation uses `OH_PORT_BASE` (formerly `NAH_PORT_BASE`); the gate-only prebuilt-assets switch is `OH_WEB_PREBUILT`.

## Security boundary

The gateway's secret config remains in a root:gateway 0750 tree, now `/etc/open-habitat/gateway.json`. The daemon's root-created per-user bindings remain in root:root 0711 parents, now `/etc/open-habitat-daemon/daemon/user-mappings/daemon-<username>.json`, with 0640 binding files and strict ownership/ACL verification. They are deliberately **not** siblings under one traversable parent. The release verifier checks that packaged gateway and daemon units retain these distinct paths. No authority moved between gateway, daemon or broker. The concrete permissions and JIT policy must be migrated in Fleetrepo before installing the new release.

## Names intentionally retained

- `docs/.glasspad.yaml` keeps the published `space_key: native-agent-host`, as does its validator and `docs/AGENTS.md`: changing that identity would create a different published space. `docs/glasspad.yaml` links the historical ADR filename `adr-0001-unix-native-agent-host.md`.
- Historical ADRs, research, issue bodies/results and captured design drafts keep their era's names and references. Issue slug `name-open-habitat` and older slugs are stable tracker identifiers, not product names.
- The current agent instructions and TODO retain `infra/native-agent-host-test/` and `infra/machines/native-agent-host-test.md` when referring to *existing Fleetrepo files*, until Fleetrepo moves them.
- `test/vm/jit-fixture.py` pins a historical Fleetrepo commit and its original `native-agent-host-*` file names and digests; changing the names inside its git-show lookups would make the immutable receipt unverifiable. `test/vm/test-jit-pinned-lock.py` uses the same historical path. Live guest JIT proof against the renamed installation requires new reviewed Fleetrepo policy bytes and an updated pin; this is part of the Fleetrepo follow-up.

## Remaining steps (in order)

1. Rename the GitHub repository to `Open-Habitat/open-habitat` and then update `origin` (no redirect assumed as a lasting contract).
2. Move `~/Sources/native-agent-host` and its `__worktrees` only after all relevant Taskfleet worktrees settle; update tw/Taskfleet project references with Fleetrepo.
3. Migrate the concrete Fleetrepo installation, JIT policy and associated project references before deployment, then validate live separate-UID permissions and document the receipts. Fleetrepo follow-up: `@markedly-witty-brick` in `~/Sources/fleetrepo/issues/markedly-witty-brick/` (filed untriaged from taskfleet run `01m48zcezhjtnhdd83h44q1bhp`). Keep the current external URL until Jari chooses a new one; no domain is assumed here.

## Decisions for review

The daemon binding tree is named `/etc/open-habitat-daemon` instead of nesting below `/etc/open-habitat`; this preserves the old 0711 traversal and the gateway-only 0750 secrets without a permission compromise. Historical design drafts remain frozen snapshots, while the current brand brief describes the new name and drops the old Omega symbol as a requirement.

## Validation

Final committed-tree gate: `OH_PORT_BASE=16720 ./scripts/ci-local.sh --clean --json` passed on `02bec4eace8c3ae05f4f4f37cfc6eac740aac4ad` with `{"status":"passed","clean":true}`. It ran 136 host browser tests, 16 lab browser tests, Go race tests, generated-contract comparison, documentation validators, VM recipe self-test, reproducible packaging, release verification and the final clean-tree check. Log: `/var/tmp/open-habitat-clean-gate-sixth.{json,log}` (local, not a portable artifact). Focused preflight: `python3 scripts/validate-project-view.py` passed (25 pages), `./scripts/vm-test.sh self-test --json` passed, and `git diff --check` passed. The receipt-race browser test passed 10 focused repeats and five repeats after requiring an observed 404 receipt. These checks do not establish a deployed test guest or different-UID isolation.

The gate required several corrections before this pass: a login test mistakenly forbade the visible new name; the live validator under `issues/define-host-contracts/` still used the previous schema URI; an in-flight send could turn uncertain after a premature 404 receipt (twice in the full suite, isolated repeat initially passed); and generated schema fingerprints were stale. Earlier attempts are logged at `/var/tmp/open-habitat-clean-gate{,-retry,-third,-fourth,-fifth}.{json,log}`. The in-flight failure led to a browser regression test that waits for the actual missing receipt. The fifth attempt passed all checks except the final clean-tree assertion; the generator updated the two fingerprint files subsequently committed. None of the prior failures remains in the final gate.

Proportionate review: examined the full rename diff and residual old-name search, then compared the gateway and daemon unit config paths against the runtime's canonical-path check, root-owned 0711 binding-parent traversal, 0640 owner/UID/ACL verification and the root:gateway 0750 secret-tree fixture. The release verifier now rejects accidental convergence of the packaged paths. This was largely mechanical with direct regression coverage; the security boundary was reviewed specifically rather than inferring isolation from browser tests. The Fleetrepo installation remains unverified until its follow-up migrates and checks the actual host permissions.
