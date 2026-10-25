# Result: connect, replace and check need both read scopes

Connect and replace now refuse a PAT that lacks `read:user` or
`read:repository` with `insufficient_scope` before tea's file or Git's helper
changes, and check reports `api: insufficient_scope` for a PAT tea already
holds without either scope.

## What changed

- `nativegitea.Client.Verify` reads `/user` and then one page of
  `/user/repos` (`page=1&limit=1`). Gitea shows a token none of its own
  scopes, so these two reads are the only way to see that both are granted.
  A 403 on either is `ErrScope`. An account with no repositories still
  passes, because an empty page is a valid answer.
- `Verifier` is now `Verify`. `Store.Connect` and `Store.Replace` call it, so
  a refused PAT never reaches the commit step. The daemon's `check` action
  calls `Verify` too. The repository list still uses `User` and `Repos` as
  before, and already reported the failure.
- `giteafake.Account.Scopes` adds a scope model to the synthetic Gitea: nil
  means the connector's pair. `/user` needs `read:user`; the repository
  list `/user/repos` needs both (Gitea 1.25.4 groups it under `/user`); the
  other repository reads and Git need `read:repository`; a write scope covers
  its read scope.
  `SetScopes` changes them at run time.
- The connect/replace form's `insufficient_scope` text now names both
  scopes instead of only user data.

## Proof

- `TestConnectAndReplaceNeedBothReadScopes` (`internal/nativegitea`): the
  real client against the fake. `Verify` refuses either single scope, while
  `User` alone still accepts `read:user` (that was the gap). Connect writes no
  tea file, a refused replace leaves its bytes unchanged, and a
  `write:repository` PAT is accepted.
- `TestGiteaConnectReplaceCheckNeedBothScopes` (`internal/daemon`): through
  the integrations routes. Connect answers 422 `insufficient_scope` with no
  tea file and `.gitconfig` unchanged. Check answers `insufficient_scope` for
  both missing scopes while the other account stays `ok`, and the list
  source fails with `insufficient_scope`. Replace answers 422 with tea's file
  unchanged, and the full pair then writes.
- **Real Gitea 1.25.4** (the disposable server on the test server,
  2026-10-25). A test binary built from this tree ran there as root against
  `https://127.0.0.1:3443` with the acceptance CA, using fresh habitat-a
  PATs:

  | PAT scopes | `User` | `Verify` | `Store.Connect` | tea file |
  |---|---|---|---|---|
  | `read:user` | ok | `insufficient_scope` | `insufficient_scope` | not written |
  | `read:repository` | `insufficient_scope` | `insufficient_scope` | `insufficient_scope` | not written |
  | `read:user,read:repository` | ok | ok (habitat-a) | written | written (temp home) |
  | `read:user,write:repository` | ok | ok | written | written (temp home) |

  The installed daemon there still runs release `ea553e4c`, so the browser
  path on the test server shows the fix only after the next test release.
  The four PATs are in root-only
  `/root/oh-gitea-accept.Ryx25bnV/tokens/scope-{u,r,ur,uw}`. The teardown in
  `issues/gitea-readonly-acceptance/result.md` removes them with the rest of
  the server.

## Review

Independent `/llm-review`, at the credential-path level. The finder was GPT-6
Astra (one call). It found no defects. It noted from Gitea 1.25.4's route
source that `/user/repos` also needs `read:user`. The connector reads
`/user` first, so this hid no bypass, but the fake now matches. A focused
verifier call (Claude Fable 5.1) asked whether any connect, replace, check,
repair or disconnect route writes a PAT, or answers `api: ok`, without
`Verify` in the same request. Its answer was "no route", with file:line
evidence for each path. The daemon package, the integrations, CLI and
gateway packages, and `scripts/test-repo-catalog-uids.sh` (two kernel UIDs)
all pass.

## Decisions for later review

- **The repository read is a single page with `limit=1`.** It costs one
  extra bounded request per connect, replace and check. It does not prove
  that every page reads; the list still reports later failures per source.
- **Check reports the first failing read.** If a PAT authenticates another
  account and also lacks `read:repository`, check says `insufficient_scope`
  rather than `account_mismatch`. Both tell the person to fix the token, and
  the list still checks the account first.
