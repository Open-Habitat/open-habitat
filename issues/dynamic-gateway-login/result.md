# Dynamic gateway login — implementation evidence

**Product revision tested:** `d00cd68513ab5f18f99561a4a84ae85c29fe0a52` (clean committed tree). This is application-level protocol integration, not a deployment.

The gateway now accepts only the numeric ID and handle from authenticated GitHub `/user` following browser-bound state and PKCE. It sends no token to the root broker. It obtains a verified broker route by `ensure`, makes one token handoff, then rechecks broker `authorize` for matching route and epoch before issuing a session. Every existing session-backed endpoint (`/auth/session`, `/auth/logout`, `/api/v1/snapshot`) reauthorizes without positive caching. Revocation, broker outage, binding drift and ledger rollback deny requests; unrelated ledger growth does not revoke another person's session. The snapshot uses the checked route, and HTTPS, Origin and CSRF controls remain. There is no SSE or active stream in this product revision (`/events` is 404). No host account is adopted, deleted or activated by this change.

## Checks

- `PATH="$PWD/.tools/go/bin:$PATH" go test -race ./internal/gateway ./internal/provision ./internal/cli` — passed, including issue-specific hermetic provider `/user`, callback concurrency, broker revocation/outage/drift, epoch/ledger rollback, lost acknowledgement and session race tests. The clean gate reran the complete Go race suite.
- `PATH="$PWD/.tools/go/bin:$PATH" go test ./...` — passed after browser-only test host was adapted to the new interface.
- `git diff --check` — passed.
- `PATH="$PWD/.tools/go/bin:$PATH" ./scripts/ci-local.sh --clean --json` — **passed**, `{"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}` on clean committed revision above. Includes locked web tests, race suite, generated checks, package/release verification and offline VM recipe validation. Full gitignored log: `history/dynamic-gateway-ci.log`.

## Security review and assessment

One scoped independent finder (`claude-fable-5-1`) found three reproducible problems in the pre-fix diff: mutable session-idle equality under concurrent requests, treating host-global ledger generation growth as session revocation, and rejecting genuine GitHub handles before broker alternate-name policy. All three were fixed with regressions before the clean gate. One focused independent verifier (`gpt-6-astra`) refuted all three against the corrected auth boundary and found no further actionable bypass in its bounded check. Review and per-finding assessment: gitignored `history/review-dynamic-gateway.md`, `history/assessment-dynamic-gateway.{json,md}`. No residual review issue was filed. The additional deterministic barrier concurrency test after the verifier changed tests only, not reviewed security code. High auth risk justified a finder plus one targeted verifier; no broad panel or repeated pass was warranted after source checks and race tests.

## Limits and later gates

All credentials, broker responses, daemon handoff and UIDs in these tests are synthetic. `ci-local` VM self-test validates a recipe, not JIT guest isolation. The private Fleetrepo allowlist/UID pool, boot ACL preparation and broker service are not approved or deployed; no real GitHub OAuth, operator alternate-name decision, private two-new-UID guest, public HTTPS ingress, host key attestation, activation or live-person smoke was exercised. Before a pilot, Fleetrepo's reviewed service declarations and private JIT guest proof plus explicit real-OAuth/ingress/person consent gates remain necessary. No Fleetrepo writes or host mutation occurred.
