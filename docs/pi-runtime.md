# Mapped daemon Pi runtime selector

The operator installs the pinned Node 22.21.1 and `@earendil-works/pi-coding-agent@0.85.1` release as a root-owned, non-writable tree. No global Node/npm installation is needed. Separately, install `/etc/native-agent-host/pi-runtime.json` as a root-owned regular file readable by mapped daemon UIDs (for example mode 0644), beneath root-owned directories with no group/world write access:

```json
{
  "node": "/opt/example/runtime-release/bin/node",
  "entry": "/opt/example/runtime-release/node_modules/@earendil-works/pi-coding-agent/dist/index.js",
  "manifest": "/opt/example/runtime-release/node_modules/@earendil-works/pi-coding-agent/package.json"
}
```

This is an installation-wide program selector, **not** a per-user binding. It carries no identity, credential, UID or home. The root provisioning broker creates and byte-verifies each `daemon-USERNAME.json` as before; do not edit those files or add `pi_runtime` to them. The gateway and browser cannot select executable paths. Existing and newly provisioned mapped daemons use the same selector after restart. The daemon rechecks selector trust and equality with the startup selection on every native Pi operation; switching releases requires restarting mapped daemons. Missing, changed, malformed or unsafe selector disables Pi (`unknown` / `native_source_unavailable`); it never unlocks workspace or history routes.

The entry is the package's public `.` ESM export (`dist/index.js`), **not** its `bin.pi` CLI (`dist/bundle/cli.js`). The paths must share one release root. The daemon checks the selected runtime tree and ancestors for root ownership, safe modes and paths, checks manifest name/version/export and invokes Node for an exact version check on each operation. The operator must independently verify the complete installed artifact against its own receipt before activation; runtime validation is not a substitute for that verification.

The daemon runs Pi as the mapped UID with that UID's HOME and Pi's own auth state. No shared credentials or new credential store are involved. A future upgrade requires a reviewed release and updated version pins; pointing the selector at an arbitrary version does not enable it. The neutral systemd service template already starts every daemon through the same binary and its unchanged per-user binding; no new unit or broker privilege is required.
