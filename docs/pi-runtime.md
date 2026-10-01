# Mapped daemon Pi runtime selector

The operator installs the pinned Node 22.21.1 and `@earendil-works/pi-coding-agent@0.85.1` release as a root-owned, non-writable tree. No global Node/npm installation is needed. Separately, install `/opt/native-agent-host/pi-runtime.json` as a root-owned regular file readable by mapped daemon UIDs (for example mode 0644), beneath root-owned, traversable directories with no group/world write access (for example `/opt/native-agent-host` mode 0755). Keep `/etc/native-agent-host` root:gateway 0750 for gateway secrets; never open it to mapped UIDs or place this selector there:

```json
{
  "node": "/opt/example/runtime-release/bin/node",
  "entry": "/opt/example/runtime-release/node_modules/@earendil-works/pi-coding-agent/dist/index.js",
  "manifest": "/opt/example/runtime-release/node_modules/@earendil-works/pi-coding-agent/package.json"
}
```

This is an installation-wide program selector, **not** a per-user binding. It carries no identity, credential, UID or home. The root provisioning broker creates and byte-verifies each `daemon-USERNAME.json` as before; do not edit those files or add `pi_runtime` to them. The gateway and browser cannot select executable paths. Existing and newly provisioned mapped daemons use the same selector after restart. The daemon checks the selector once at startup and refuses to start if it is missing, malformed or unsafe. Changing the selector or binding file, or switching releases, requires restarting mapped daemons. Neither the gateway nor a browser request can override these startup facts.

The entry is the package's public `.` ESM export (`dist/index.js`), **not** its `bin.pi` CLI (`dist/bundle/cli.js`). The paths must share one release root. The daemon checks the selected runtime tree and ancestors for root ownership, safe modes and paths, checks manifest name/version/export and invokes Node for an exact version check once at startup. The operator must independently verify the complete installed artifact against its own receipt before activation; runtime validation is not a substitute for that verification.

The daemon runs Pi as the mapped UID with that UID's HOME and Pi's own auth state. No shared credentials or new credential store are involved. A future upgrade requires a reviewed release and updated version pins; pointing the selector at an arbitrary version does not enable it. The neutral systemd service template already starts every daemon through the same binary and its unchanged per-user binding; no new unit or broker privilege is required.

Pi credentials are different: a newly created user has none, and can still start the daemon and reach onboarding. Existing credential paths are checked when a user starts device login, where an unsafe path can be reported without blocking native reads. A status request may invoke the Pi helper to report first-use login state, but it does not re-walk the release tree or re-read the selector.
