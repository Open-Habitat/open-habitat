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

Record the final committed product revision, binary digest and full JSON result
here after the last rerun on committed code. A preliminary end-to-end boot
returned `status=passed`, `scope=product-two-user-routing`, `launched=true`,
`pid1=systemd`, UIDs `[21001,21002,21003]`, both three-directory route results,
all reported denial and native-gh booleans true, and token scan passed (189 s,
600 s boot cap, 2 MiB serial cap, pinned image SHA
`612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354`).
That boot preceded the additional guest-side binary digest, source symlink and
real credential-fill-output checks and is **not** the final revision proof.

The offline recipe test checks parser and invalid cases, private ISO byte-for-byte
injection, seed layout, binary digest rendering and teardown/timeout wiring.
Clean CI calls only `self-test` and does not boot. Phase 3 still owns the real
browser UI composition and screenshots, host-backed visual acceptance, final
issue checks and conductor-mediated Jari decision; this document does not set
`testing`, toggle acceptance or claim live GitHub/Pi credentials.
