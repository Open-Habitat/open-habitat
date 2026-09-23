# Phase 2 native product proof (phase 3 remains)

The parent issue remains **in-progress**, with acceptance boxes unchanged. This is a
synthetic two-UID product route, not browser visual acceptance or a live-host
installation. Phase 1 delivered the gateway OAuth state/PKCE, fixed numeric-ID
mapping and opaque sessions. Phase 2A replaced the initial custom framing with
ADR 0003's bounded HTTP/1.1 single Unix socket. Phase 2B delivered the native
`gh` adapter, descriptor-based immediate-directory discovery, daemon socket
activation, authenticated snapshot route, and positive keyring metadata
attestation. This phase adds the booted product integration those isolated
results could not claim.

## Product boundary and correction

`./scripts/vm-test.sh two-user-routing --json` builds the current CGO-free binary
and records its SHA-256, creates a private small cloud-init seed and read-only
ISO for the binary, checksum-verifies the pinned public Ubuntu image, and boots
QEMU TCG with systemd PID 1 under rootless Podman (`--network=none`, guest user
network `restrict=on`). It does not install host packages, create host users or
homes, contact real providers, or change Fleetrepo/systemd. All private seed,
ISO, overlay and serial data are torn down. Only the verified public image and
tool cache remain. The guest creates 21001/21002/21003 and uses a loopback TLS
GitHub fixture, fixed synthetic numeric IDs, browser-like TLS cookie jars, and
fake `gh`/`git` confined to the guest. The fake `gh` writes only user-owned
mode-0700 directories and mode-0600 credential files. Tokens enter the adapter
on stdin, never argv or environment. A root-owned trusted config maps each ID
to a single systemd-owned mode-0660 user:gateway socket; the gateway process
runs under 21003. Binary digest is checked after guest installation.

The VM exposed two real product integration defects that same-UID tests missed.
First, on a systemd-created socket, client `SO_PEERCRED` reports the root socket
creator, not the later daemon UID. Both clients now require that root peer **and**
a mapped-UID-owned mode-0660 socket in a root-controlled, symlink-free directory
chain, while the daemon separately requires the gateway UID on every accepted
connection. Second, a socket-activated service starts with the triggering
request already queued: the startup listener challenge used to consume that
request instead of its own connection. The validation now preserves bounded
verified gateway connections and hands them to the guarded HTTP listener after
checking the challenge, with no fallback endpoint or skipped check.

## Guest assertions

- Both HTTPS OAuth start redirects carry state and PKCE S256; the callback
  exchanges the code with guest-local fixed token/user endpoints. A and B gain
  separate cookie sessions and route through the actual gateway and systemd
  sockets into two effective daemon UIDs. An unknown numeric ID, unknown
  session, and state replay are denied.
- Each authenticated snapshot has three immediate directories: ordinary,
  `.git`-hinted, and no metadata. Neither shows the other user's names, paths
  or sentinel. Forged browser identity, UID, username and socket headers cannot
  reroute. A source/child symlink to the other home is rejected/excluded.
- Exact native login and setup argv, stdin-only token handoff, status/API
  numeric identity, HTTPS protocol, helper and credential-fill observations,
  protected-file storage, credential isolation and UID-specific daemon config
  argv are asserted. Root connections are refused by the daemon; opposite
  users cannot connect to the other socket or read the other home/credential;
  the gateway cannot read either user's home or credential. Stopping A's
  socket/service yields no alternate route, B remains reachable, and restarting
  A's socket reactivates A only.
- Both sentinels are sought in bounded browser responses/headers/cookies,
  process argv/environment, service journal excerpts, trusted configs and
  child argv logs. Only guest provider fixture inputs and each user's protected
  native credential are allowed to hold the tokens. Host source, binary and
  bounded serial are scanned too; neither token value is printed by the recipe.

## Verification and remaining limits

Committed product/fixture revision `da413270c3cb149373415908d1d3cb02db2eb461`:
`./scripts/vm-test.sh two-user-routing --json` exited 0 in 162 s with
`status=passed`, `scope=product-two-user-routing`, `launched=true`,
`pid1=systemd`, UIDs `[21001,21002,21003]`, socket mode `0660`, routes
`31001→21001` and `31002→21002` with three workspaces each, all native-gh
and denial flags true, and `token_scan.passed=true`. The guest checked the
binary SHA-256 against the host-created digest
`1efe3f4bfdd421499265185b1f679e884a102a94c12266c945f11f3edc4d189e`.
The pinned cloud image SHA-256 was
`612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354`;
the digest-labelled tool image ID was
`1fcba77437f7aa1094f784c23d5e9197d6a7d532bcac860ee311aa94f77775f2`.
The download limit is 2 GiB/360 s, boot limit 600 s, serial limit 2 MiB,
container 4 GiB/2 CPUs, and the base virtual disk 3.5 GiB. No VM/container or
private run directory remained after completion. This was an on-demand
socket-activated boot; no daemon was prestarted. Exact JSON is reproducible
with the command above; the success output carries no token value.

Focused phase-2 security review checked root-owned config and root-traversal
permissions, systemd socket owner/group/mode and activation envelope, daemon
and gateway effective UIDs, peer checks in both directions, fixture-only TLS
CA/hosts against fixed production GitHub URLs, callback state/PKCE and numeric
mapping, cross-home and forged-header denials, protected native credential
storage, source/child symlinks, no alternate route after A is stopped, and
bounded token scans. The two confirmed product findings (client-side
`SO_PEERCRED` reporting PID 1 and queued activation request consumed by the
startup challenge) were corrected before the successful boot. Final review
also found the shipped socket template lacked the explicit descriptor name;
`FileDescriptorName=daemon` and `DirectoryMode=0711` now match the successful
fixture and are checked offline. This template-only correction does not change
the binary or the exercised guest recipe. The review did not prove an actual
production GitHub consent, installed OS keyring, or protection from a hostile
process already running under the same Unix UID or root.

`bash test/vm/test-vm-test.sh` passed (offline parser, schema fixture, rendered
unit/config syntax, byte-for-byte ISO injection, binary digest, error envelope,
checksum and teardown/timeout wiring). `go test -race ./... -count=1`, `go vet
./...`, both contract/plan validators, project-view validator,
`issuectl doctor --json` and `git diff --check` passed with repository-local
Go/TMPDIR. `./scripts/ci-local.sh --clean --json` passed on clean `da41327`
with `{"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}`;
it covers full Go/browser/package checks but boots only the offline `self-test`.
The guest-local source files contain sentinel construction instructions, not
the completed per-user token values; exact-token `git grep` on committed source
returned no matches. Transient guest input/credential files were removed with
the private overlay and ISO; only the checked public image/tool cache remain.

Phase 3 still owns the real browser UI composition and screenshots, host-backed
visual acceptance, final issue checks and conductor-mediated Jari decision;
this document does not set `testing`, toggle acceptance or claim live
GitHub/Pi credentials.
