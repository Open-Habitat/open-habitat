# Result

## 1. A revoked gh token no longer blocks sign-in

Evidence (gh 2.45.0 upstream and Ubuntu gh 2.46.0, disposable homes, bogus
`gho_` token, real api.github.com):

| Situation | `gh auth status --hostname github.com` | `gh api --hostname github.com user` stderr |
|---|---|---|
| token rejected by GitHub | exit 0, stdout "token … is invalid" | exit 1, `gh: Bad credentials (HTTP 401)` |
| network down (refused proxy, DNS failure) | exit 0, the **same** "token … is invalid" | exit 1, `error connecting to …` / Go dial error |
| token unreadable (keyring entry missing) | exit 0, "token … is invalid" | exit 1, `gh: Requires authentication (HTTP 401)` |
| only an Enterprise login | exit 1, `You are not logged into any accounts on github.com` | without `--hostname`, gh queried the Enterprise host |

So `auth status` cannot tell a dead token from a network outage on these
versions (newer gh exit 1 for both, per upstream `status.go`). The rule now in
`internal/nativegh/native.go`: Install replaces an existing login only when
`gh api --hostname github.com user` fails with exactly
`gh: Bad credentials (HTTP 401)`, **and** hosts.yml names exactly one
github.com account (the active one), **and** gh's credential files are
unchanged since that classification. gh's `AuthConfig.Login` writes the
incoming user's entry, so without the sole-account check a working inactive
account could be overwritten. Network failures, keyring failures, unknown
wording, other accounts' working logins and multi-account configs are still
refused untouched. Other changes: the identity probe is pinned to github.com;
the "no accounts on github.com" diagnostic counts as absence; cleanup counts
only gh's own absence diagnostic as proof the login is gone, and runs only
after our own login succeeded while gh's files are still the ones it wrote.
Status reports a revoked token as `disconnected` (it was `unknown`), so the
account page says the connection was not found.

Tests: fake runner (revoked → installed; another stored account, legacy
format, native login meanwhile, failed login → untouched), and the real
Executor against fake `gh`/`git` scripts reproducing gh 2.45's exit-0
"invalid" output (revoked → installed and connected; offline, locked keyring,
working foreign account, revoked beside another account → no `gh auth login`
and hosts.yml byte-identical). The new guards were mutation-checked. A live
run of the real Executor with real gh 2.45.0 and 2.46.0 against GitHub
classified a bogus token as revoked. Review: gpt-6-astra as finder,
claude-fable-5-1 as verifier; both findings confirmed and fixed.

## 2. Why the token became invalid: not caused by our flow

Pilot journal (read-only): the pilot's dedicated OAuth App (“Open Habitat
(Northwind)”, its client id matches the GitHub authorization email) made exactly
**one** code exchange before the failure: 2026-10-23 10:45:37, the one that
was installed. Other `/auth/github/start` events at 10:28–10:45, 11:00 and
11:48 never reached the callback, so they minted no tokens. Then 2026-10-24
04:35:56 and 04:36:04 were two exchanges that failed in the handoff. Nothing
in our code revokes or resets tokens (no `/applications/…/token` call; the
gateway has the client secret but never uses it that way). Clones go through
gh's credential helper and never put the token in a URL.

Ruled out:
- GitHub's limit of ten tokens per user/app/scope: only one token existed.
  Also, that limit revokes never-used tokens first, and the installed token
  was in use.
- Jari or the app owner revoking the whole authorization: the 04:35 flows
  went through in about 3 s with no consent screen, and no new "OAuth
  application has been added" email came (the Northwind inbox has only the
  10:45 one).
- An egress block on the pilot: no nft/iptables output rules, no proxy, no
  `IPAddressDeny` on the daemon unit, and the gateway reached GitHub at 04:35.

Remaining causes, all outside our flow: that single token was revoked
individually (pushed to a public repo or gist and caught by secret scanning,
reported to GitHub's credential revocation API, or deleted by the app owner
with the client secret), or it was never invalid. The conductor's evidence
was `gh auth status` only, which prints "invalid" on a network failure too,
and the logout at 04:38:43 removed the token, so this cannot be decided after
the fact. One read would settle it: Jari's GitHub security log
(github.com/settings/security-log) around 2026-10-23 10:45 to 2026-10-24
04:35, looking for `oauth_access.destroy` or `oauth_authorization.destroy`
and its actor. No email about a revoked or leaked token reached the Northwind
mailbox, where GitHub mail arrives.

## Limits

- The rule trusts GitHub's 401. A spurious "Bad credentials" during a GitHub
  incident would replace a working sole login with the person's own fresh
  token.
- An own but partial login (for example a missing git credential helper) is
  still refused, and a token gh cannot read (locked keyring) stays
  unclassified. Both still block sign-in until fixed natively. Neither was
  observed; they are unchanged by this work.
- Between the final stamp check and gh's own read-modify-write inside
  `gh auth login`, a concurrent native login can still be lost. That window
  belongs to gh, and the absent path has it too.
- Every sign-in still mints a token that the daemon discards when gh is
  already logged in. These tokens never get used, so GitHub's ten-token limit
  revokes them first and leaves the installed one alone. Revoking them from
  the gateway would hand the gateway a new authority, so it was not done.
- Newer gh (≥ 2.50) multi-account exit codes were checked only from upstream
  source.
- The fix is not deployed to the pilot. The conductor owns it.
