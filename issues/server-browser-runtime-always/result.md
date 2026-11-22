# Result: required server-browser runtime

**Release inputs: unchanged.** No core/profile archive, package manifest, Google
key, minimum version, or runtime verification contract changed. This is a
product-only update; it does not require a matching runtime rebuild.

**External deployment integration:** a deployment path that bypasses product
`host apply` / `host upgrade` does not inherit this guarantee. Its owner must
run an equivalent required installation/verification step and fail deployment
acceptance when it fails. That companion integration is outside this repository;
it must not be mistaken for evidence from this change.

## Delivered behavior

- Apply and upgrade require Chrome after entries reopen, including otherwise
  no-change runs. Failure returns `server_browser_required`, outcome
  `server_browser_failed`, and a named `server_browser.reason`. The completed
  generation operation is not rolled back or refenced.
- Missing, partially installed, below-minimum, or missing-executable Chrome
  is installed/repaired through the existing Google repository/key and apt
  safety rules. Acceptance reobserves the installed package state, version and
  executable after apt. An unreadable package database fails explicitly.
- `host check` and the public inspection API report `server_browser.chrome`;
  doctor also fails its Chrome check. Reads are networkless and never repair.
  Plans name the required post-reopen action and remain approvable when Chrome
  is absent, so the operation that repairs it is reachable.
- TigerVNC remains a core Ubuntu requirement, enforced by the existing required
  package transition. No UI text or feature switch changed.
- The operator guide explains failure, retry, first-install readiness and the
  air-gapped requirement. Package qualification now runs the Chrome install and
  repeat test as well as all Ubuntu requirements.

## Decisions for later review

1. **Keep apt after reopen, but fail the command.** Alternative: put Google
   download/installation inside the closed-entry transition. Network/apt lock
   delays cannot reliably fit the 100-second downtime budget. The chosen step
   contributes no closed-entry time and takes the operation lock again while
   checking/installing. A failed postcondition leaves the already completed
   generation receipt intact; a fresh apply plan retries it. Actual Chrome
   install plus repeat took 17.37 seconds in the disposable arm64 container;
   this is not a test-server downtime measurement. No live deployment was run.
2. **No site.json opt-out.** Alternative: let an administrator waive Chrome on
   an air-gapped host. That contradicts the requested every-installation
   guarantee. A qualifying, already-installed Chrome needs no Google request;
   otherwise an unreachable Google source causes explicit refusal. An
   administrator may supply a qualifying package through their own package
   distribution, but cannot waive the required postcondition.
3. **Repair old installations through the same step.** Upgrade and no-change
   apply both check the native dpkg record rather than trusting a stray file.
   The existing minimum 157.0.8103.38-1 remains; newer packages are left to apt.
4. **Keep the experimental card's unavailable message.** It already says the
   environment is missing and the administrator must upgrade. It remains
   relevant during repair, after an interrupted install, or following native
   package removal. No visible application change, so no UI trial note.
5. **Readiness is not approvability.** Missing Chrome is a named failure even
   before first installation. The guide explicitly directs operators to apply
   dry-run for approvability, not to gate first apply on host check success.

## Verification

Tested the final implementation diff from base
`6cb1b36bae17bd56c26c50eced534ce81de74c24` on Linux arm64, under umask 077 and
bounded commands with the scratch lease:

- `./scripts/test-focused.sh --area go --go-package ./internal/host` — pass.
- `./scripts/test-focused.sh --area go --go-package ./internal/cli` — pass,
  including named doctor failure and redacted host-error mapping.
- `./scripts/test-focused.sh --area contracts` — pass.
- `./scripts/test-host-initialization-uids.sh` — pass on retry. First run
  exposed two existing upgrade tests whose contract examples were not mounted
  into the container. Added the missing read-only mount; the complete root
  and distinct-UID fixture then passed, including the split-/var scenario.
- `bash scripts/test-ubuntu-requirements.sh` — pass in disposable Ubuntu
  24.04 arm64: all nine profiles' Ubuntu requirements (166.15 seconds), then
  actual Chrome installation, package-owned source/key equality, and no-change
  repeat (17.37 seconds). Nothing installed on the development host.
- `python3 scripts/test-cloud-qualify.py` — 22 passed; offline harness only.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  `git diff --check` — pass.

Evidence directory: `/var/tmp/agent-keep/server-browser-runtime-always/`.
The apt and root-container logs are `apt-container.log`, `host-uids.log`
(initial failure) and `host-uids-retry.log` (pass).

Not run: a live test-server deployment or downtime measurement, amd64 apt,
full installed-host/cloud qualification, the clean gate or browser suite.
No packaging input changed. Unit tests and actual apt are not a full native
apply→Google-failure→retry journey with live services; that orchestration
boundary was checked by source tracing in both independent reviews.

## Independent review and assessment

Critical-rigor `/llm-review` for deployment integrity: claude-fable-5-2 finder,
gpt-6-astra independent verifier, two calls. One documentation defect (a
nonexistent command name) was confirmed and fixed. The proposed fresh-host
readiness code change was rejected against the explicit requirement and actual
qualification callers; the guide was clarified instead. `/assess-findings`:
FIX 1 (applied), DROP 1, no remaining findings or filed follow-ups.

Local artifacts: `history/review-server-browser-runtime-always.md` and
`history/assessment-server-browser-runtime-always.{json,md}`. No authority,
archive verification semantics, session state, or browser contract changed.
