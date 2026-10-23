# Onboarding repository HTTP/2 regression

## Diagnosis

On 2026-10-23 the pilot negotiated HTTP/2 and returned HTTP 400 for the exact
catalog route even without authentication. The gateway's initial shape check
required HTTP/1.1, so it never looked up a session or called the daemon. Calling
the exact daemon endpoint as the gateway Unix UID returned schema 1, a complete
catalog and 54 repositories. Only counts were inspected; no credentials or live
repository names were saved.

## Change

Accept HTTP/1.1 and HTTP/2 browser requests at the affected gateway routes.
The daemon connection still serializes HTTP/1.1 and retains its own strict
framing and peer checks. Authentication, mapped sockets, body constraints,
origin and CSRF checks remain independent and unchanged. The same defect in
clone, checkout, workspace, editor and terminal HTTP control routes is corrected
so the next onboarding action does not fail identically. WebSocket upgrades are
unchanged.

Catalog refusals now emit `github_repo_catalog` with fixed reasons distinguishing
request/authentication, socket/peer, transport/framing, native authorization and
catalog validation failures. Neither errors from gh nor request/repository content
are included.

## Validation

- Focused gateway/daemon catalog and lookup tests: pass.
- Real TLS/ALPN HTTP/2 gateway test: both synthetic sessions receive only their
  own mapped catalog. No identity headers/credentials are forwarded to daemons.
- Protocol matrix across all affected handlers: HTTP/1.1 and HTTP/2 reach auth;
  HTTP/1.0, unsupported versions and transfer encoding remain refused.
- Catalog rejection diagnostics: fixed reason present, sentinel secrets absent.
- Contract generation and schema checks: pass.
- `npm ci --prefix web --no-audit --no-fund` then focused Vitest adapter,
  repo chooser and catalog tests: 3 files / 20 tests pass. There is no separate
  GitHubOnboarding unit file; the command's unmatched filename is not coverage.

Full clean gate is not claimed. The first full gateway race run used permissive
shell umask and failed the existing clone integration's private-directory mode
check; the isolated fixture requires umask 077. Retry result recorded below.

## Pilot coordination

The hands-on worker retains sole installation ownership. It confirmed no active
operation, pilot.7 not released/installed and current dev2 generation
`50d7e0d28dbfbf8a5a2f547fa6a42c0a56c41a6436e5e625c2a5fded47cb3c1d`,
source `52b103ea27023836e640bf9c814d88dd75438b32`. Its cold-boot fix must remain
in any successor. Deployment/readback and issue closure are pending.

Retry with `TMPDIR=/var/tmp; umask 077; go test -race ./internal/gateway
-count=1` passes the complete gateway package, including the existing native
clone integration. `go vet ./internal/gateway`, project-view validation,
issue doctor and `git diff --check` also pass. This was a fixture mode issue,
not a reason to weaken production private-directory checks.

## Targeted independent review

Claude Fable (`claude-fable-5-1`) reviewed the final protocol/diagnostic diff and
nearby auth, CSRF, mapping and proxy code; no material defect found. It also
reran focused tests and vet. Local self-review confirms daemon-hop checks and
WebSocket upgrade checks are untouched. The reviewer noted that unknown-length
HTTP/2 GET bodies can reach authentication, but no GET body is forwarded or read
and the shared proxy refuses negative length; this is not a reachable authority
or data defect and no residual issue is filed. Browser fetch cannot send GET
bodies. Review scratch is `history/review-onboarding-repos-targeted.txt`.

## Independent live readback after deployment

The coordinated installer adopted the fix as
`418a23dd776a6195e495eb53f5ec59881236bb36` on top of the cold-boot correction
and installed **0.1.0-pilot.6-dev3**, not a published pilot.7 release. Native
upgrade `cda46b218f724801bfce27c96bd65856` completed at sequence 6. The installer
reported the product's browser-session preservation proof passed and all host
checks healthy. The requested maintenance restart used exact-plan approval,
with native active turns observed as zero; no ad-hoc restarts or state-file edits.

This worker independently read back on 2026-10-23:

- Actual running gateway executable SHA-256:
  `90c4c50c2b3a8f7875c10a6ee3d1f1a5ebe47236984979c5722175f928d3ee47`.
- Installed owner generation:
  `a80e8bcfe3f3da533a70be19efff00fb92e43db6c190aaae3222e47d540e3498`.
- Native operation state: completed, sequence 6, matching version/generation.
- Exact catalog request through the daemon socket as the gateway UID:
  schema 1, complete, **54 repositories**, no error. Saved only this count.
- Public CA-validated HTTPS/HTTP2 catalog without cookies: **401**, previously
  400. The installer also confirmed fixed failure reason
  `authentication_required` in the gateway journal.

No Jari cookies/tokens were used, printed or copied. Asked the conductor and
notified Jari to refresh the existing chooser. Browser confirmation is pending;
no claim of a completed browser journey is made yet.

## Browser acceptance and closure

The hands-on installer relayed the conductor's chooser-success confirmation and
explicit approval to publish pilot.7. This worker independently checked only
fixed journal fields and confirmed the live catalog route returned HTTP **200**
at `2026-10-23T11:00:41.119795116Z` (`outcome=completed`). Together with the
count-only native catalog and synthetic real-HTTP2 mapped-session regression,
this establishes recovery of the reported chooser failure. No live browser
screenshot, repository names, cookies or tokens were collected.

Pilot.7 publication/upgrade remains the other worker's responsibility and is
not a condition of this fix's closure: the independently verified installation
for this result is dev3. The installer reports pilot.7 is being built from a
rebased source including this fix; no final pilot.7 installation is claimed here.
