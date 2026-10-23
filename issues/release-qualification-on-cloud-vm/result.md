# Result (in progress)

The open-habitat half is in place: `scripts/cloud-qualify.py` qualifies a
release on a fresh stock Ubuntu 24.04 VM through the released `open-habitat
host` operator only, and `cloud-qualify.py run` is the one command that gets a
short-lived Hetzner VM from Fleetrepo, qualifies and destroys it. TESTING.md now
names this as the release qualification path. **No live run has happened yet**:
it needs the Fleetrepo operator specified in
[fleetrepo-interface.md](fleetrepo-interface.md). Until it exists, `run` fails
with `qualification_vm_operator_missing`, and `target --target FILE` works
against any VM provisioned by hand.

## What a run does

`plan` validates the published release directories offline (exactly one
product package, signed manifest, every archive, successor signed for that
exact predecessor) and prints the stages. `target`/`run` then:

1. connect with a pinned Ed25519 host key; require Ubuntu 24.04, x86_64,
   systemd, and no prior `/etc/open-habitat`;
2. customer baseline: stock apt mirror asserted, `apt-get update` and `upgrade`,
   reboot if required;
3. customer storage: refuse a volume with any signature or a non-empty `/home`;
   install `linux-modules-extra` only if `quota_v2` is missing (recorded);
   `mkfs.ext4 -O quota`, fstab by UUID with `usrquota`;
4. delivery: package extracted root-owned under `/opt`, runtime files to the
   incoming directory, key, 0711/0700 parents, 0600 secrets and site with
   `listen 0.0.0.0:443`, digests checked after transfer;
5. prepare (approved plan, `--approve-disruption`);
6. apply: wrong approval refused as `stale_plan`, SIGKILL at `converging`,
   continuation with the original approval to `applied`, exact repeat
   `no_change`, host check, CA-validated public HTTPS 200;
7. first use: broker `ensure` as the gateway UID for two synthetic people, own
   agent environment 200 and the other UID refused, administrator granted on
   re-apply, quota override read back, a home file written as each person;
8. cold boot: units, host check, HTTPS, agents, quotas, home files, apply
   `no_change`;
9. upgrade: successor package stages, owner SIGKILLed at `activating`, cold
   boot while fenced must not serve HTTPS 200, continuation to `upgraded`,
   repeat `no_change`, running gateway executable equals the successor binary;
10. cold boot again with the same checks.

The result document lists what is not covered (browser OAuth, provider
authorization, public-CA/DNS/ingress, per-profile workflows, power-loss torn
writes).

## Emulated scripts removed and kept

Removed, because the cloud run replaces them as release qualification:

- `scripts/test-host-apply-vm.sh`, `scripts/test-host-upgrade-vm.sh` and their
  guest proofs `test/vm/host-apply-proof.py`, `test/vm/host-upgrade-proof.py`,
  `test/vm/check-upgrade-receipt.py`, `test/vm/test-host-upgrade-fixture.py`,
  `test/vm/profile-image.env` (the emulated union path; it needed an external
  trusted runner, a pinned cloud image plus hand-extracted quota modules, and it
  never met the pilot's deployment defects).
- `scripts/test-core-runtime-vm.sh`, `test/vm/core-runtime-proof.py`,
  `test/vm/profile-runtime-proof.py`, `test/vm/container-probe/` and the tests
  in `scripts/test-profile-runtime-build.py` and
  `scripts/test-browser-runtime-build.py` that only compiled or drove them.
  TESTING.md already called these historical: they install offline Ubuntu debs,
  which the current verifier rejects, so they could not run against a schema-2
  release. This also retires the local runtime-VM memory guard tuned just before
  in `vm-guard-overreserves-memory`; no local runtime VM remains to admit.

Kept: `scripts/vm-test.sh` and its scenarios. They drive conditions a
customer-path VM should not be driven into (absent, unenforced or mismatched
home volume at boot; pending, revoked and foreign bindings; broker crash
points) and are development-time component evidence, not release
qualification. The clean fresh-installer experiment stays the final acceptance
before a customer release.

Coverage the removed emulated apply/upgrade proofs had and the cloud run does
not yet repeat: SIGKILL at apply `staging`/`verifying` and upgrade
`verifying`/`verified`/after-open, admission removal and re-admission epochs,
a corrupted successor archive refusing without closing entry, a synthetic
browser session and persistent user service surviving the upgrade, and the
separate negative quiescing target. Native/root-container journal tests still
cover split publication at every phase. The per-profile workflow recipes
(containers lifecycle, browser Playwright, uv/python, editor) are recoverable
with `scripts/from-history.sh test/vm/profile-runtime-proof.py` for porting.

## What remains

1. Fleetrepo implements `open-habitat-qualification-vm` per
   [fleetrepo-interface.md](fleetrepo-interface.md) (create/destroy/reap/list,
   labels, TTL reaper timer, per-run firewall and host key).
2. First live run: `python3 scripts/cloud-qualify.py run --predecessor
   <pilot.N> --successor <pilot.N+1> --release-key <key> --json --receipt ...`
   from Alder. Expect the first run to find harness assumptions that only a
   real Hetzner image can show (quota module packaging, mirror hostname in
   `ubuntu.sources`, cloud-init timing, prepare's session restarts under SSH).
   Fix forward, then close this issue.
3. Optional later stages: per-profile workflow probes on the qualified VM.

## Decisions for later review

- Authority split as given by the conductor: open-habitat owns the harness and
  holds no cloud credentials; Fleetrepo owns provisioning, firewall, host-key
  pinning and expiry. Unchanged.
- TLS uses a per-run CA generated on the qualification host and the fixed
  origin `qualification.invalid`, not a test DNS name with a public
  certificate. The product consumes the same PEM files either way; public-CA
  issuance is customer infrastructure and is listed as not covered.
- The SSH host key is injected by the operator through cloud-init `ssh_keys`
  and returned as a `known_hosts` line, so the first connection is pinned rather
  than trust-on-first-use.
- Interruptions (apply at `converging`, upgrade at `activating` plus a fenced
  boot) are on by default: an interrupted maintenance is a real customer event
  and the pilot met one. `--no-interrupt` skips them.
- Synthetic first login goes through the broker socket as the gateway UID
  because there is no browser; this is observation instrumentation, not an
  installation step.

## Validation

See the commit for the exact tree. Ran: `python3 scripts/test-cloud-qualify.py`
(13 tests), `python3 scripts/test-profile-runtime-build.py`,
`python3 scripts/test-browser-runtime-build.py`, `bash -n scripts/ci-local.sh`,
`python3 scripts/validate-project-view.py`, `issuectl doctor --json`,
`git diff --check`. Shellcheck is not installed and the repository does not use
it; the new code is Python. No Go was touched. No VM was booted.
