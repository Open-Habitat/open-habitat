# Result

`host check` now exposes the gateway's last GitHub expiry observation as
`github_token_expiring`, with the OAuth app opt-out and reconnect instructions.
Warnings appear in JSON's envelope `warnings` and as `warning:` lines in text,
including when unrelated checks block the command. They do not change readiness,
exit status, or plan approval/fingerprints.

The gateway atomically publishes only `expiring` or `non-expiring` in a 0600
file at `/var/lib/open-habitat-gateway/github-token-expiry`. There are no tokens,
refresh tokens, account names, timestamps or per-person records. A later
non-expiring grant clears the warning. Malformed expiry metadata preserves the
last observation. State-write failures log a fixed warning and do not reject
sign-in. Root's bounded, no-follow reader reports unusable state separately.

## Decisions for later review

- **Warning, not failing check.** The installation still works; failing health
  or maintenance would obstruct fixing an OAuth app setting. Readiness and plan
  fingerprints remain independent of this diagnostic.
- **A file in the existing gateway state directory, not journal scraping or a
  new socket operation.** Root already reads gateway-owned state. This adds no
  identity or action authority and stores no credentials. New state filename:
  `github-token-expiry`; no systemd unit, tmpfiles template, directory ownership
  or permission changes. Fleetrepo needs no provisioning change.
- **Last successful grant/identity exchange, not per-person gh status.** The
  observation is recorded before admission and handoff: even a refused person
  can reveal the app's expiry setting. Failed exchanges and malformed metadata
  preserve earlier evidence. There is no timeout-based clearance: only a
  confirmed later non-expiring exchange clears it. A missing file is no
  observation and silent; invalid/unreadable state is a non-blocking warning.
- **Recovery guidance keeps the requested after-expiry route.** Opt out first,
  then reconnect after the existing token expires. An ordinary sign-in while
  it works keeps gh's old token. The operator guide also retains the newer
  explicit Settings reconnect, which can replace a working token immediately.
  Clearing the app warning does not promise every person's gh token changed.

## Verification

Tested the completed code on Birch, based on `016573c3`, under umask 077 with
private disk-backed TMPDIR, Python jsonschema in a disposable uv environment,
and `OH_PORT_BASE=11800`, `OH_BROWSER_WORKERS=2`:

- `scripts/test-focused.sh --area go --go-package ./internal/gateway`: pass.
  Extended synthetic-GitHub `TestExpiringTokenSignInWarns`: durable → expiring
  → malformed (warning preserved) → durable; exact credential-free state,
  private file permissions, restart preservation. Added failed state-write
  sign-in success and secret-free diagnostic coverage.
- Same focused command for `./internal/host`: pass. Missing, expiring, durable,
  malformed/oversized, symlink and FIFO observations covered.
- Same focused command for `./internal/cli`: pass. Warning and fix appear in
  success JSON/text and unrelated-failure JSON/text; readiness stays true for
  warnings, empty observations yield an empty warnings array.
- `scripts/test-focused.sh --area web`: pass, 169 files / 1265 tests plus
  lint/type checks. Two existing informational lint hints, no errors.
- `scripts/test-focused.sh --area contracts`: pass, 88 schemas / 136 fixtures /
  43 scenarios, generated sources unchanged.
- `python3 scripts/validate-project-view.py`, `git diff --check`: pass.

No browser behavior or specs changed; no whole browser suite or clean gate run.
No real OAuth app, live installation, distinct-UID or power-loss testing claimed.

## Review

Independent `/llm-review`: claude-fable-5-1 finder and gpt-6-astra narrow
false-negative verifier of the gateway/root diagnostic boundary. Neither found
an actionable correctness defect. Finder's structural reader suggestion was
assessed as not a defect; reused the existing bounded private-file reader to
reduce duplication, then reran all touched Go suites. Full ancestry-helper
suggestion was not applied because its /var/tmp fixture claim was false and
production ancestors are fixed root-owned /var/lib. `/assess-findings`: zero
fix/spinoff/discuss, one dropped structural suggestion. Model assessment logged
through the canonical Alder writer. Local scratch review and assessment are in
`history/review-github-expiry.md` and `history/assessment-github-expiry.json`.

## Tool failures

Initial discovery commands used nonexistent filename globs and returned errors;
scoped searches located the actual files. One exact-edit call matched two test
fixture sites and was refused atomically; a unique-context retry succeeded.
`test-focused.sh --help` printed usage but exited 2; its documented area commands
all passed. These were tooling/discovery errors, not failed product checks.
