# Mapped daemon Pi runtime binding

The operator installs the pinned Node 22.21.1 and `@earendil-works/pi-coding-agent@0.85.1` bundle as a root-owned, non-writable release directory. No global Node or npm installation is needed. Each mapped daemon's root-owned daemon JSON config may contain:

```json
"pi_runtime": {
  "node": "/opt/example/runtime-release/bin/node",
  "entry": "/opt/example/runtime-release/node_modules/@earendil-works/pi-coding-agent/dist/index.js",
  "manifest": "/opt/example/runtime-release/node_modules/@earendil-works/pi-coding-agent/package.json"
}
```

These three paths must share one release root. The entry is the package's public `.` ESM export (`dist/index.js`), **not** its `bin.pi` CLI (`dist/bundle/cli.js`). The config and its ancestors must be root-owned and non-writable by other users; the daemon additionally checks each runtime path and ancestor for root ownership, no symlinks, and no group/world writes, checks manifest name, version and export, then invokes the selected Node to check its exact version before each operation. Missing binding or failed validation yields only `unknown` / `native_source_unavailable` through the HTTP contract. The operator should verify the installed artifact's complete contents against its own receipt before activation; runtime validation is not a replacement for that verification.

The daemon does not install packages or read credentials from this shared tree. It runs the Pi SDK as the mapped UID with that UID's HOME, and Pi continues to own its own auth state. This config does not change the broker mapping or require a gateway credential. A future upgrade requires a new release and reviewed version pins; changing the config to an arbitrary Pi version does not enable it.
