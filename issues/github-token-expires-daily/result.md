# Result

## Cause

Birch's GitHub OAuth app `maalla-habitat` issues **expiring tokens**: GitHub
gives them an eight-hour lifetime and a refresh token. gh cannot refresh
another app's token, and Habitat never kept the refresh token. So gh's login
dies eight hours after every sign-in.

Evidence, read on Birch on 2026-10-27, with no token printed:

- GitHub's answer to `gh api -i user` with the token installed at this
  morning's sign-in (07:26:01, attempt `bzU2eyZ3ou4RyitKzW20fQ`) carries
  `Github-Authentication-Token-Expiration: 2026-10-27 13:26:01 UTC`. That is
  exactly eight hours after the sign-in, and `X-Oauth-Client-Id` is Birch's
  app.
- GitHub's changelog of 2026-08-14 ("Multiple redirect URIs and token refresh
  for OAuth apps") says OAuth apps can issue eight-hour access tokens with
  six-month refresh tokens, and that this is on by default for new apps. The
  app can opt out under Optional features.
- Every earlier death fits the window: 25.10 05:53 → dead before 18:11;
  25.10 18:11 → worked at 21:55 (last taskfleet push) and was gone by
  morning; 26.10 12:55 sign-in → a private `git fetch` succeeded at 19:45:22
  (reflog of `~/src/open-habitat`), and the token was rejected by 07:26
  (`native_gh_install phase=installed`, which replaces only a token GitHub
  answers 401). The Northwind pilot app in `gh-stale-token-blocks-login` died the
  same way (10:45 → before 04:35).
- The sign-in revocation of `github-sign-in-tokens-revoke-gh-login` did not
  cause it. The gateway journal from 26.10 13:24 has no `github_token_revoke`
  event, and Jari made no sign-in between the 19:45 fetch and the 07:26
  reconnect. The test server uses a different OAuth app (compared by client-id
  hash), and no `gho_` token appears in agent transcripts, `~/.config`,
  `~/.local`, `/var/tmp` or repository working trees.

## Fix

The decisive fix is the app setting, which only Jari can change: on GitHub, go
to Settings › Developer settings › OAuth Apps › maalla-habitat › Optional
features and opt out of expiring user tokens. Then reconnect once **after**
the current token has expired, when Yhteydet shows Vanhentunut. A sign-in made
while the old token still works keeps gh's login and revokes the new token
(the kept-login rule), so it would not install the durable one.

In the product:

- The gateway reads `expires_in` from the code exchange
  (`GitHubProvider.ExchangeGrant`) and logs `github_token_expiring`
  (WARN, `expires_in_s`, attempt id) when GitHub issued an expiring token.
  The sign-in still goes on. Neither token is logged, and the refresh token
  is never read. An unexpected `expires_in` shape only loses the warning.
- `docs/operations.md` tells operators to opt out when they register the app,
  and how to recover. `internal/AGENTS.md` records why Habitat holds no
  refresh token.
- Test: `TestExpiringTokenSignInWarns` drives the real `GitHubProvider` through
  the callback against a synthetic GitHub. It checks that there is no warning
  without expiry, that a warning carrying `expires_in_s` 28800 comes with
  expiry, that neither token is logged, and that a malformed `expires_in`
  still signs in. Removing the warning fails it.

Review: gpt-6-astra (finder) found that the doc's first recovery wording ("sign
in once more") would revoke the new token. claude-fable-5-1 confirmed this
against `nativegh.Install`, and the wording is fixed.

## Decisions for later review

- **Habitat does not refresh tokens.** The alternative is for the gateway to
  keep the refresh token and the client secret, and to rotate gh's token every
  eight hours. That would make Habitat a credential broker, which root
  `AGENTS.md` rules out, so the fix is the app setting plus an operator
  warning. If Jari wants expiring tokens for their security benefit, that is an
  architecture decision with a refresher design of its own.
- An expiring token is still handed to gh rather than refusing the sign-in, so
  a misconfigured installation keeps working for eight hours at a time and
  does not lock people out.
- The warning goes only to the gateway journal, where server-maintenance
  sweeps read warnings. It is not shown in the UI.
- The test server's OAuth app was not checked for expiring tokens. If it was
  registered after August 2026, it needs the same opt-out.
