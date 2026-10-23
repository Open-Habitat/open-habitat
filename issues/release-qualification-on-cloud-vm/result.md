# Result

`python3 scripts/cloud-qualify.py run` qualified the published **0.1.0-pilot.7**
and an upgrade to a successor built from main on a fresh Hetzner cx33 (fsn1)
from the stock Ubuntu 24.04 image, through Fleetrepo's
`open-habitat-qualification-vm`, and destroyed the VM. Every stage passed:
customer baseline (133 packages upgraded from `mirror.hetzner.com`, reboot),
ext4 `/home` with enforced quotas on the blank volume (quota modules installed
from `linux-modules-extra`), prepare, apply with a refused wrong approval, a
SIGKILL at `converging` continued to `applied` and a `no_change` repeat,
CA-validated HTTPS 200 on port 443, first use for two people with each own-UID
agent 200 and the other UID refused, administrator granted, quota override read
back, cold boot, the upgrade killed at `activating`, the fenced boot not
serving, continuation to `upgraded` with the running gateway equal to the
successor binary, and a final cold boot. No product defect was found: one run failed on
cloud capacity, one on a harness defect, and the first passing run exposed two
more harness defects. The redacted passing receipt
is [receipt-pilot7-to-qual1.json](receipt-pilot7-to-qual1.json) (only the
destroyed VM's address is redacted).

## Live runs

Inputs: predecessor = the downloaded GitHub release v0.1.0-pilot.7 (manifest
`e567abbd…`, executable `5a0b7245…`, all `SHA256SUMS` OK), release key
`97963aeb…` from the retained development key on Alder (not the copy published
beside the release). Successor = `0.1.0-pilot.7-qual.1`, packaged by
`prepare-test-release.sh --ungated` from main `24de62f0` (executable
`d03b9f22…`, package `7c990adc…`), reusing all twelve pilot.7 archive bytes and
signed with the development key as the named upgrade from pilot.7 (manifest
`aedbf46f…`). Unpublished; it exists only under `/var/tmp` on Alder.

1. `20261023t131828-b1cb7b`, nbg1: Hetzner `POST /servers` answered 412
   `resource_unavailable` (no cx33 capacity). The operator deleted the volume,
   firewall and key it had created; no server existed. Fix: `--location fsn1`,
   documented in TESTING.md.
2. `20261023t131859-63bc47`, fsn1: failed at `deliver`. The released operator
   refused the harness's site: `$.editor: must be present exactly when profiles
   includes editor`. Harness defect (the fake target never validated a site).
   Fixed in `71e45003`: the site declares `editor.origin_template`
   `https://*.code.qualification.invalid` when the editor profile ships, and the
   per-run leaf also covers that wildcard; the fixture now asserts it. The
   corrected site was checked against the product's own `ParseSite`/`Validate`
   before the next run.
3. `20261023t134035-2659ab`, fsn1: **passed**, about 45 minutes. Two harness
   observations from it: the upgrade resent all 1.1 GB of unchanged archives
   (13 of its 18 minutes), and the receipt credited the harness commit that was
   HEAD when the run *ended*, because it was read at the end and I committed
   during the run. Fixed in `52994f59`/`1e7b6961`: archives whose delivered
   digest already equals the signed one are not resent (test asserts one core
   upload, two editor uploads), and the harness identity is taken when a
   `run`/`target` starts (`plan` stays offline). Run 3 actually ran `71e45003`.
4. `20261023t143139-1e70d0`, fsn1: **passed** on harness `1e7b6961`, clean
   tree; this is the saved receipt. Upgrade stage 661 s instead of 1094 s.

After every run `open-habitat-qualification-vm list --json` showed no
resources. Four of eight allowed runs used, never more than one VM at a time.

Observed real-image facts the offline fake had only assumed, now confirmed:
the stock image's apt sources name `mirror.hetzner.com`; the stock kernel lacks
`quota_v2` and `linux-modules-extra-$(uname -r)` supplies it; per-user daemon
and agent sockets are already active after a cold boot before anyone connects;
during the fenced boot nothing answered on 443 at all (statuses `[null]`).

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

## Later

Optional later stages: per-profile workflow probes on the qualified VM, and the
coverage the emulated proofs had that is listed above. Building the successor
by hand is now `scripts/successor-descriptors.py` plus `runtime-release sign`
(TESTING.md).

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
- Fleetrepo should run the reaper on a second host too; until then a Alder
  outage leaves at most two small servers running until Alder returns.
- Synthetic first login goes through the broker socket as the gateway UID
  because there is no browser; this is observation instrumentation, not an
  installation step.

## Review

Independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.1) and
`/assess-findings`: five findings, all confirmed and fixed in the follow-up
commit. A SIGINT/SIGTERM during `destroy` killed the operator mid-deletion (now
signals are held until deletion finishes and the operator runs in its own
session; the new test fails without it). The spec overclaimed a cost bound
while Alder is down (reworded; it asks for a second reaper host). Cross-UID
agent access after reboot or upgrade was recorded but not failed (enforced at
every checkpoint). The fenced-boot check sampled once just after SSH answered
(now waits for boot to settle and samples a 30-second window). The agent probe
started the daemon service as root, which would mask a broken socket
restoration (it now only connects as the person and records socket state).

## Validation

Harness phase: `python3 scripts/test-cloud-qualify.py` (14 tests),
`python3 scripts/test-profile-runtime-build.py`,
`python3 scripts/test-browser-runtime-build.py`, `bash -n scripts/ci-local.sh`,
`python3 scripts/validate-project-view.py`, `issuectl doctor --json`,
`git diff --check`.

Live phase: the four runs above. Afterwards `python3
scripts/test-cloud-qualify.py` (15 tests, with the successor-descriptor case),
project-view validation and `git diff --check`. `successor-descriptors.py`
reproduced byte for byte the hand-written descriptors that signed the
qualified successor. No product (Go or web) code changed, so no Go, web or
browser focused checks were required and no `/llm-review` of an install-path
product fix applies; the changes are to the qualification harness and its docs.
