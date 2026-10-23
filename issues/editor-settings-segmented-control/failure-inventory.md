# Recovered command and environment failures

- Initial focused web run caught the new reload button's missing required
  `size` prop. Added `size="row"`; final checks rerun from fresh inputs.
  Initial log: `/var/tmp/editor-settings-web.log` on Alder.
- The checked-out browser entrypoint has no remote placement implementation,
  despite the web instructions requiring remote execution on Alder. Ran the
  maintained focused commands in a disposable Ubuntu arm64 container on
  Cedar's already-running Podman VM instead. No household service restarted,
  no installed application binary changed, one browser worker/suite at a time.
- Remote setup first attempted to mount a Mac `/var/tmp` directory unavailable
  inside the Podman VM (`statfs ... no such file`). Copied the disposable inputs
  into VM `/var/tmp`; the next attempt hit SELinux volume denial when writing
  `apt.log`. Relabelled only that private mount with `:Z`; installation succeeded.
  Logs: `/var/tmp/editor-settings-remote-{setup,setup-retry,install}.log` on Alder.
- Discovery probes found no cached Node/Go/Chromium in the existing test-tools
  container (exit 127), no repository `host-manager.ts`/Fleetrepo `bin` directory,
  no a11y-named spec, and no local browser-runner executable. Used actual fixture
  modules and the disposable container route; none of those guessed paths was
  a required input. No missing check is counted as a pass.
- A repeated eight-worker web run under concurrent Alder load timed out in
  unrelated Integrations/StartHere cases. Stopped that run rather than keep
  loading the host; reran the complete focused web command with the supported
  `OH_WEB_WORKERS=1` budget and all 533 passed. The initial full web run after
  the type fix had also passed; the final budgeted run covers the shortened
  help text. Logs: `/var/tmp/editor-settings-web-{final,verified,budgeted}.log`.
- First remote suite launch lacked Python in the minimal Ubuntu image.
  Installed Python only in the disposable container and retried. Next run
  passed the settings-preference journey but 14 document journeys failed
  before editor opening because the container ran the daemon as root (the
  native controller requires a non-root user). Reran both suites as synthetic
  UID 1001 without changing product code or fixture behavior. Initial browser
  log: `/var/tmp/editor-settings-browser.log`; remote run logs:
  `/var/tmp/editor-settings-remote-{suites,suites-retry,nonroot}.log` on Alder.
- Checking the input hashes directly through the VM's default user failed on
  private files owned by the container test UID. Repeated the same checksum
  check inside that container as UID 1001: all seven inputs matched. No file
  permissions were broadened to bypass the check.
- The non-root remote run passed 11/15 editor cases and all 4 Settings lab
  cases, but save/conflict journeys refused writes: Fedora's default container
  storage adds `security.selinux` xattrs, which the editor deliberately refuses
  to drop on save. Confirmed the xattr on a disposable file both with and
  without container labelling. Kept that product check intact and reran on a
  private disk-backed ext4 scratch mount with a mount-wide SELinux context
  (no per-file xattr). This matches the supported Ubuntu filesystem semantics;
  no tmpfs build scratch or host policy change. Initial non-root suite log:
  `/var/tmp/editor-settings-browser-final.log` on Cedar; disk-backed retry:
  `/var/tmp/editor-settings-disk-validation.log` on Alder. The first disk-backed
  retry still failed the same four cases: the browser fixture explicitly creates
  synthetic homes under `/tmp`, not `$TMPDIR`. The trace confirmed HTTP 415
  `file_unsupported`. Mounted the same private disk at runtime `/tmp` as well
  as build `$TMPDIR=/var/tmp` and repeated the complete suite. Trace summary:
  `/var/tmp/editor-settings-trace-summary.json`; original archive:
  `/var/tmp/editor-settings-failed-trace/trace.zip` on Alder.

- Closing with the brief's requested `fixed` status was refused: this issue is
  an improvement and the tracker reserves `fixed` for bugs. Closed it as the
  legal delivery status `done`, without retyping it or weakening the schema.

All required checks ultimately completed successfully. The temporary containers,
three derived images, private ext4 mount/image and disposable source/tools were
removed; Cedar's pre-existing Podman VM remains running as found. Cleanup log:
`/var/tmp/editor-settings-cleanup.log` on Alder. No remaining delegated workflow,
service, review or validation is incomplete. No external review was required by
the task's conditional review bar.

- Final committed-range `git diff --check` found trailing whitespace inherited
  from browser-serialized CSS in the static HTML snapshots. Trimmed line endings
  in those four inert snapshots and reran the committed-range check. Removed
  macOS AppleDouble transfer sidecars before landing; screenshots and rendered
  semantics are unchanged. No product source or test input changed.
