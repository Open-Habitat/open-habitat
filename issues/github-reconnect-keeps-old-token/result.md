# Result

## Cause

What I found on Birch on 2026-10-27, read-only and with no token printed:

- The gateway and daemon journals reach back to 26.10 15:23. In that window
  the only GitHub sign-in is the 07:26 reconnect (attempt
  `bzU2eyZ3ou4RyitKzW20fQ`). The daemon logged `native_gh_install
  phase=installed token_unused=false`, because GitHub had rejected the old
  token, and no `github_token_revoke` was logged. The issue's case has not
  happened on Birch yet.
- gh's token is valid now (`gh auth status` exits 0), and GitHub reports
  `Github-Authentication-Token-Expiration: 2026-10-27 13:26:01 UTC` for it.
  `hosts.yml` was last changed at 07:26:03.

The defect comes from the code, and it blocks the recovery
github-token-expires-daily prescribed. While the connection shows as
working, Koodipalvelut had no reconnect button: it was offered only for
`expired` or `disconnected`. Every other sign-in took
`nativegh.Install`'s own-account path. That path keeps gh's login, the daemon
answers `unused`, and the gateway revokes the new token. So once Jari opts
the OAuth app out of expiring tokens, nothing can install a lasting token
before the current one dies at 13:26 UTC.

## Fix

- **Browser:** the Koodipalvelut button "Yhdistä GitHub uudelleen" is now
  also shown, as a secondary button, while the connection is `connected`.
  The settings reconnect starts `/auth/github/start?return_to=…&reconnect=1`.
  The login card's ordinary sign-in sends no `reconnect`.
- **Gateway** (`internal/gateway/auth.go`): `start` accepts the intent only
  from a valid session with exactly one `Sec-Fetch-Site: same-origin` header.
  The Lax cookie also rides on a cross-site navigation, so the header is what
  separates them. It stores the session's subject in the pending flow and
  logs `oauth_callback started reason=reconnect|reconnect_refused`. A refused
  intent becomes an ordinary sign-in. The callback uses
  `ReplacingSink.DeliverReplacing` only when the GitHub ID that signed in
  equals that subject and the binding already existed.
- **Transport:** the handoff request gains an optional `"replace":true`. It
  is refused when false, null, duplicated, or combined with a plan or seed.
- **Daemon** (`internal/nativegh`): `Install(ctx, token, replace)` replaces
  the own-account login (phase `replaced`) only when gh positively holds a
  different token, it is gh's only github.com account, and gh's files are
  unchanged since classification. Otherwise it keeps the login, exactly as an
  ordinary sign-in does: `already-correct`, and the gateway revokes an unused
  token. A replaced login answers `in_use`, so the new token is not revoked.
- `internal/AGENTS.md` states the rule, and `docs/operations.md` now tells
  operators to reconnect once after the opt-out instead of waiting for
  Vanhentunut.

Tests:
- `TestExplicitReconnectReplacesGhLogin` (gateway, real `GitHubProvider`
  against a synthetic GitHub) covers: a same-origin reconnect replaces and
  revokes nothing. A cross-site start, a start without the header, a start
  without a session, an ordinary start, and a reconnect that signs in as
  another GitHub account all deliver ordinarily, and the unused token is
  revoked.
- `TestExplicitReconnectReplacesOwnLogin` (nativegh) covers: replace, the
  same token, an unreadable token, another stored account, a native change
  in between, and a foreign active login.
- `TestHandoffCarriesReconnect` (transport) covers the wire format.
- Mutation checks: removing the replace switch, the stamp check, the
  `soleAccount` check, the same-subject check or the `Sec-Fetch-Site` check
  each fails a test.
- Browser specs: the expired-state spec checks that the settings start
  carries `reconnect=1`; the ordinary sign-in spec checks that it does not.

Checks: focused Go for nativegh, transport, gateway, cli and daemon (green;
the daemon tests need Python `referencing` and a short `TMPDIR`), `go vet`,
web checks, and the two touched account-settings browser cases.

Review: gpt-6-astra (finder) found two problems. The ordinary LoginCard
also sent `reconnect=1`, a copy slip. Replace mode could also overwrite an
inactive second gh account if a handoff carried the wrong token.
claude-fable-5-1 (focused check) found that a native change between
classification and replacement failed the sign-in and left the token
unrevoked. All three are fixed and covered by tests.

## Decisions for later review

- **The old token is not revoked**, although the acceptance criterion asks
  for it. Revoking needs the gateway's app credentials and the token's
  value, which exists only in the person's gh store. Sending it from the
  daemon to the gateway would carry a native credential out of the person's
  account. Today tokens flow only from the gateway to the daemon, and the old
  token may be a native one (gh's own app, extra scopes). Once replaced, the
  token exists nowhere on the host. An expiring one dies within eight hours,
  and a lasting one falls out of GitHub's ten-token window or can be revoked
  under GitHub › Settings › Applications.
- **A reconnect replaces only gh's sole github.com account.** If someone
  keeps several accounts in gh, a reconnect keeps the login as an ordinary
  sign-in does. This is the same guard the revoked-token path uses. The
  assessment ranked it DROP (RARE: it needs a misbehaving gateway), but it
  was kept because the daemon must not trust the gateway.
- **Browsers without Fetch Metadata** (Safari before 16.4) send no
  `Sec-Fetch-Site`. There a reconnect silently becomes an ordinary sign-in,
  and the only trace is `reconnect_refused` in the gateway journal. The UI
  does not say so.
- While connected, the reconnect button is a secondary button next to the
  status rather than hidden behind a menu. A reconnect made by mistake
  replaces gh's token with an equivalent one and drops any extra scopes added
  natively (e.g. `workflow`).

## What Jari needs to do

Opt the OAuth app out of expiring tokens (GitHub › Settings › Developer
settings › OAuth Apps › maalla-habitat › Optional features). After this
change is deployed to Birch, press Koodipalvelut › GitHub › "Yhdistä GitHub
uudelleen" once. `gh api -i user` should then show no
`Github-Authentication-Token-Expiration` line, and the daemon journal should
show `native_gh_install phase=replaced`.
