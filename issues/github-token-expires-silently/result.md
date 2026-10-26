# Result

## Cause

- Birch's Habitat signs in through a GitHub **OAuth App** (client `Ov23…`),
  and the token in `~/.config/gh/hosts.yml` is a `gho_` OAuth App token. That
  rules out the suspected GitHub App user token (`ghu_`, 8-hour expiry plus
  refresh token). OAuth App tokens have no expiry and no refresh token, so
  there was nothing to refresh.
- GitHub revoked the token on its side. `gh api user` gets
  `gh: Bad credentials (HTTP 401)`, and `hosts.yml` has not changed since
  Habitat installed it at the 18:11 sign-in (that sign-in's session is in the
  gateway's session store). Nothing in Habitat or Fleetrepo revokes tokens, and
  no `gho_` token appears in agent transcripts or repositories on Birch.
- Birch's evidence does not show *why* GitHub revoked it. The journal only
  goes back to 21:24, and gateway sign-in events before that are gone. Only
  Jari can see the reason, in the GitHub security log
  (github.com/settings/security-log, `oauth_access` events). The 05:53 token
  had also died before the 18:11 sign-in replaced it.
- Habitat does feed one revocation mechanism: every sign-in mints a new
  token with the same scopes, and `gh` keeps the oldest one. GitHub revokes
  the oldest once an app has more than ten tokens per user and scope. Nobody
  signed in overnight, so this cannot explain this particular night, but it
  will eventually break every connection. Filed unlaned as
  `github-sign-in-tokens-revoke-gh-login`, with a recommendation.

## What was wrong in Habitat, and the fix

When GitHub rejected the token, the daemon reported `disconnected`. The
settings row then said "Ei yhdistetty — GitHub-yhteyttä ei löytynyt" and
offered no action, even though `gh` still holds the login and offers it to
every push. The only way back was signing out and in again.

Now:
- `nativegh` reports `expired` for a login GitHub itself rejects. The
  snapshot contract gains `native_github.state = "expired"`.
- Settings › Yhteydet shows **Vanhentunut** with a red cross and the
  explanation that git push and gh do not work, plus a button,
  **Yhdistä GitHub uudelleen**. The button is an ordinary GitHub sign-in that
  returns to the same page. The sign-in's token replaces the rejected one
  (the existing revoked-replacement path), and the row returns to
  Yhdistetty.
- The background recheck still notices a revocation within about 5 minutes
  of snapshot traffic, with no local file change needed.

Tests at the boundary:
- `TestTokenRevokedAtGitHubShowsExpiredAndSignInReconnects` uses the
  synthetic `gh` executable fixture through the real Executor. It covers
  sign-in → connected → GitHub revokes with no file change → expired → one
  sign-in → connected. It fails on the old code ("still reported as
  disconnected").
- `account-settings.spec.ts` "an expired gh login says so and one sign-in
  reconnects": row, no disconnect offer, axe in light and dark, the reconnect
  round trip through the synthetic provider.
- Evidence (device scale factor 2): `evidence/github-expired-light.png` and
  `evidence/github-expired-dark.png`.

## Decisions for later review

- The reconnect button appears only for `expired`. `disconnected` also covers
  a foreign gh login, where a sign-in would fail. Before this change it had
  no button either.
- The cause was not fixed by changing which token `gh` keeps. That would
  alter the rule "a later login reobserves native state instead of replaying
  a token", which is an architecture decision. It is filed as
  `github-sign-in-tokens-revoke-gh-login` with two options.
- Jari: please look at the GitHub security log for the reason the 2026-10-25
  token was revoked (oauth_access.destroy / revoke). If the reason is the
  token limit, the filed issue is the fix. If it is something else (secret
  scanning, manual revocation), that is new information.
- Review (gpt-6-astra) confirmed one edge: when gh holds a second
  github.com account (added only by a native `gh auth login`) and the
  active token is revoked, the row still offers reconnect, but Install
  refuses to replace a non-sole account, so the sign-in ends in
  `auth_error=native_adapter_error`. That was already the outcome of any
  sign-in in that situation. It was dropped as rare, because fixing it would
  need a further contract state.
