# Result

Fix 1 is implemented: the gateway revokes the token of a sign-in when the
daemon kept an existing gh login.

- **Handoff wire** (`internal/transport`): every successful handoff now gets a
  200 JSON reply with `"github_token":"in_use"|"unused"`. The plan-less 204 is
  gone. A reply without the field, or with any other value, is refused, so the
  sign-in fails closed.
- **Daemon** (`internal/nativegh`): the daemon says `unused` only on the
  own-account `already-correct` path, and only when `gh auth token --hostname
  github.com` shows a non-empty token that differs from the delivered one
  (constant-time compare). If that token cannot be read, or equals the
  delivered one, the answer is `in_use`.
- **Gateway** (`internal/gateway`): `TokenSink.Deliver` returns the answer, and
  so does `FirstLoginReply.Token`. On `unused` the callback revokes the token
  with `DELETE /applications/{client_id}/token` and the app's basic auth
  (`GitHubProvider.RevokeToken`, through the optional `TokenRevoker`
  interface). The call is synchronous with a 5 s timeout and does not depend
  on the browser request. A failure is logged as `github_token_revoke`
  `outcome=failed`, without the token or GitHub's text, and the sign-in goes
  on. A lost or failed handoff revokes nothing.
- The rule is now in `internal/AGENTS.md`, under the GitHub token bullet.

Tests: `internal/gateway/token_revoke_test.go` drives the real
`GitHubProvider` against a synthetic GitHub that mints a new token per
exchange. It checks that the token gh holds is never revoked, that the unused
token is revoked exactly once with the app credentials, that `in_use` revokes
nothing, that a refused revocation keeps the sign-in, that a lost answer
revokes nothing, and that the binding-creating login revokes as well. An
inverted condition fails all three callback tests. Transport tests cover the
new reply and its malformed variants; nativegh tests cover the other, same,
unreadable and empty token cases, a fresh install, and a failed install.

Checks: focused Go tests for transport, nativegh, gateway, cli and daemon are
green, `go vet ./...` is clean, web checks pass, and the whole browser
suite passes (385 passed, 3 skipped).

No screenshots: nothing visible changes.

## Decisions for later review

- `unused` additionally requires gh to *positively* show a different token.
  This guard is not in the issue's fix 1. It means a token that might be the
  installed one is never revoked, for example if GitHub ever returned the same
  token for a repeated authorization. The cost is one `gh auth token` read in
  the kept path.
- Revocation runs synchronously before the session is issued. It adds one
  GitHub round trip, at most 5 s, to a sign-in that kept gh's login. Doing it
  in the background would hide failures from the request's own attempt id.
- The handoff reply schema stays at version 1. Pre-release, a daemon and
  gateway from different builds fail closed, so there is no compatibility
  path.
