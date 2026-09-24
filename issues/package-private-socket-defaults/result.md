# Package socket fallback fix

Tested base revision: `8099520d39f7285abb23c849ccbe5c7683cc1c95` plus this issue's worktree changes (release version metadata points to base HEAD before commit).

The shipped `native-agent-host-daemon@.socket` now uses `DirectoryMode=0710`. The release verifier requires exactly one `DirectoryMode=0710` in the packaged `[Socket]` section after manifest verification; the offline regression rebuilds valid manifests/checksums for 0711, 0755 and duplicate-mode variants and confirms rejection. The VM offline test now checks the shipped unit separately; its independently generated synthetic fixture remains 0711 and is **not** proof of package safety.

Before enabling or starting any per-user socket, including after reboot, the reviewed root broker/operator must securely pre-create and verify the private root-owned parent and per-UID socket directory, granting named search ACL access to the authorized dynamic daemon UID and gateway traversal. Fail closed on missing or drifted preparation. `0710` by itself cannot grant a newly allocated UID traversal or prove isolation. Package verification does not inspect live ACLs; this change does not implement a broker-side activation preflight. Fleetrepo currently pins the **old** release bytes with a reviewed 0710 override; moving to a rebuilt package requires a separate reviewed Fleetrepo transition. No guest, Fleetrepo or live socket was changed.

Verification (repository-local Go 1.27.1; Node 22.23.2):

- `go fmt ./...`, `go vet ./...`, `go test -race ./...`, `CGO_ENABLED=0 go build -trimpath ./cmd/native-agent-host` (disposable output): passed.
- `npm ci --prefix web`, `npm run build --prefix web`: passed.
- `./scripts/vm-test.sh self-test --json` and `bash test/vm/test-vm-test.sh`: passed (offline; no boot).
- `./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/`, `./scripts/verify-release.sh --archive dist/native-agent-host-0.0.0-test-linux-amd64.tar.gz --json`, `bash scripts/test-package-socket.sh dist/native-agent-host-0.0.0-test-linux-amd64.tar.gz`: passed; negative tests rejected re-signed world-searchable and duplicate-mode variants.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed.

No booted VM, actual host ACL or Fleetrepo transition was verified here.
