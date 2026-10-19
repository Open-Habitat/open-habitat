# Result: committed accounts get lingering

The broker now asks logind to enable lingering after a successful durable
binding publication, successful socket activation and the final locked admission
recheck. Existing admitted bindings get the same idempotent operation in the
asynchronous boot restore pass, after successful socket activation and before
integrations signal inspection. Explicit ensures also
repeat it, so a failed attempt can recover on the next sign-in. Authorize stays
read-only, and partial provisioning never enables linger.

`LinuxHostExecutor.EnableLinger` checks root authority and the exact NSS
name/UID/GID/home/shell binding before invoking only
`/usr/bin/loginctl enable-linger <committed-name>`. It has a 15-second overall
budget (individual commands use the existing shorter bound). Failure becomes
`broker_linger`, outcome `rejected`, reason `enable_failed`; success is outcome
`enabled`. No raw command output is logged or returned. A linger failure alone
does not reject login, prevent socket restoration, or skip the next account.

No new broker data or personal-file read is introduced. Logind owns its native
linger marker. No neutral systemd/tmpfiles change or Fleetrepo configuration
follow-up is needed: the root broker calls logind over D-Bus, and logind writes
`/var/lib/systemd/linger` outside the broker's `ProtectSystem=strict` namespace.
The concrete deployment must have working systemd-logind and loginctl; the
post-release check below verifies that assumption.

## Evidence

Implementation commits: `1cf78c50` and `d1fbd85c`; final runnable code tested
was the code committed as `d1fbd85c` (before documentation/tracker closure).

- `go test -race -count=1 -v ./internal/provision ./internal/cli` and
  `go vet ./internal/provision ./internal/cli` pass. Tests exercise durable
  post-commit timing, activation refusal, final-admission revocation, denied
  identities, interrupted provisioning phases,
  read-only authorization, renamed candidates, revoked/uncommitted boot
  targets, repeated restore, failed linger with continued login/restoration,
  and fixed redacted diagnostics.
- `./scripts/test-focused.sh --area contracts` passes (generated files clean;
  52 schemas, 47 fixtures, 35 scenarios, 17 negative checks).
- `./scripts/test-broker-boot-uids.sh` passes in a disposable networkless
  rootless Podman Ubuntu container as container root. It now creates real NSS
  users under distinct kernel UIDs 2100–2103 and routes the boot linger action
  through the production executor. Only committed users 2100–2102 reach the
  exact loginctl invocation; uncommitted 2103 does not. A mismatched UID and
  unsafe name are rejected before loginctl. The existing inotify proof still
  observes no reads/opens inside the synthetic homes. **Loginctl itself is
  intercepted:** this does not establish real logind behavior.
- Ordinary Go runs skip the container-only UID proof, the existing root-only
  CLI admin socket case, and an existing wrong-owner source case. The container
  command supplies the distinct-UID evidence, not those ordinary Go skips.
- An initial compile failed because the startup-only executor double lacked
  the new interface method. It was corrected with a panic-on-call method that
  also preserves the startup inspection's no-side-effect invariant; reruns pass.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check` pass. Doctor reports no schema violations; existing
  unrelated attachment advisories remain.
- Independent `/llm-review`, critical rigor, finder `claude-fable-5-1`, verifier
  `gpt-6-astra`, two successful calls. `/assess-findings`: **1 FIX, 1 DROP**.
  The FIX was enabling linger before activation/admission refusal; `d1fbd85c`
  reorders it and adds regressions for activation failure and concurrent
  admission removal. The DROP was a proposed `disable-linger` authority on
  later revocation: native persistence is intentional; deprovisioning is not
  part of the accepted enable-only task. Local audit artifacts are
  `history/review-broker-enable-linger.md` and
  `history/assessment-broker-enable-linger.{json,md}`. Performance corpus
  publication was explicitly disabled to respect this run's no-push policy.
- Review limit: admission and the logind mutation are not atomic. The ordering
  fix prevents the cited rejected-activation paths, not every possible
  concurrent revocation: boot snapshots and already-active sockets still
  have the existing activation policy's limits. No synchronous termination or
  disabling of native services on browser-admission revocation is promised.

## Decisions for later review

- **Only admitted committed accounts are enabled at boot.** Revoked bindings
  are verified but excluded, following the existing socket restore policy.
  The alternative was enabling every historical committed account, including
  revoked ones; that would unnecessarily grant a new persistent user manager
  to a person currently denied admission. This change does not disable linger
  already granted before revocation.
- **Enable on each explicit ensure as well as boot**, instead of maintaining a
  separate completion marker or only attempting once at creation. Logind's
  operation is idempotent, this heals transient failure without new state,
  and the browser's candidate name never selects the target.

## Exact test-VM check after release

Do not run this against Alder. On the disposable test guest, as root, choose an
existing admitted account that signed in before this release. Repeat with a new
account after its first browser sign-in. Replace the value on the first line:

```sh
u=REPLACE_WITH_COMMITTED_TEST_USERNAME
uid=$(id -u "$u")
# Release activation must restart the broker; this explicitly exercises its boot pass.
systemctl restart open-habitat-broker.service
# Wait until this user's broker_linger event appears, then check logind's native truth:
journalctl -u open-habitat-broker.service --since '-2 minutes' -o cat | grep 'broker_linger'
loginctl show-user "$u" -p Linger                    # Linger=yes
systemctl is-active "user@${uid}.service"            # active
as_user() {
  runuser -u "$u" -- env XDG_RUNTIME_DIR="/run/user/$uid" \
    DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" "$@"
}
as_user systemd-run --user --unit=oh-linger-proof --property=Type=exec /usr/bin/sleep 600
before=$(as_user systemctl --user show oh-linger-proof.service -p MainPID --value)
test "$before" -gt 0
systemctl restart "open-habitat-daemon@${u}.service"
as_user systemctl --user is-active oh-linger-proof.service  # active
after=$(as_user systemctl --user show oh-linger-proof.service -p MainPID --value)
test "$before" = "$after" && echo 'same user service survived daemon restart'
as_user systemctl --user stop oh-linger-proof.service
```

Expected: a successful `broker_linger` event for each admitted committed user,
`Linger=yes`, an active user manager, and the same transient-service PID after
the daemon restart. No `broker_linger` event should target an uncommitted or
revoked account. `enable_failed` is a release-check failure to investigate,
not evidence that background service survival works. This live check has not
been run by the worker; no push or deployment was performed.
