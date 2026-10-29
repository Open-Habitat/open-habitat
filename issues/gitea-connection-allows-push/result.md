# Result: Gitea connection allows push

A Gitea connection now asks for the person's own `read:user` +
`write:repository` PAT, and Git pushes with it through the existing native
credential helper. That path has no new store, broker or browser push control.
A `read:repository` token is still accepted, and connect, replace and check
name it `read_only`. The page also checks each shown connection once by itself,
so an existing read-only connection says *Vain luku: … push ei onnistu* on
its card before a push meets Gitea's bare 403. The rule that replaces ADR
0031's read-only first scope is in `internal/AGENTS.md` (`nativegitea/`).

## How push is known without pushing

Gitea shows no token its scopes. The API's `permissions.push` is the
account's own right: a read-only token sees `push: true`, which is what Jari
saw. The daemon therefore makes the first request of `git push` itself:
`GET <repo>.git/info/refs?service=git-receive-pack`, with the same Basic
credential the helper gives Git, for the first repository on `/user/repos`
page 1 that the account may push to and that is neither archived nor a mirror.
In Gitea 1.25.4, `githttp.go` `httpBase` runs `CheckRepoScopedToken` at write
level for Basic-auth tokens before it advertises anything, and only for Basic
auth, which is why the probe does not use the `token` header. A missing scope
is a bare `Forbidden` (Base.HTTPError). Gitea's other 403 refusals there
(DISABLE_HTTP_GIT, an inactive owner, a disabled account) carry their own
text and read as `unknown`. The advertisement changes nothing on the server.
The reply field is `push`: `allowed`, `read_only` or `unknown`, given only
beside `api: ok` (contract `gitea-connection-change`).

## Verified

- Go: `nativegitea` (`TestPushReadsTheTokensWriteScope`: read-only, write,
  `all`, a collaborator's push right, no pushable repository, a wrong
  token, a bad user, and HTTP Git off; only `info/refs` requests are sent),
  `nativeforge`, the full `internal/daemon` package
  (`TestGiteaPushFollowsTheTokensScope`: with a read-only token connect and
  check say `read_only` and a real `git push` through the native helper fails
  with 403. After a write-token replace the same clone pushes and the server
  branch moves, no token reaches the clone's config, and a revoked token's
  check carries no `push`), `daemon/integrations`, `test/browser-host`.
- Contracts: validate-contracts (plus a negative case: `push` without
  `api: ok`), generated packages clean.
- Web: static, unit and component checks (`./scripts/test-focused.sh --area web`).
  New tests cover the automatic check, a connect's answer not being checked
  again, and the person's own write waiting for the automatic check in flight.
- Browser (`OH_PORT_BASE=6900`, 2 workers): `integrations.spec.ts` Gitea (3,
  now including read-only at Gitea → card and fresh page say `read_only`),
  `clone-page.spec.ts` Gitea (4), `settings-three-pages.spec.ts` (10).
- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) and `/assess-findings`. Two confirmed findings were fixed
  here: every 403 had been read as read-only, and the automatic check collided
  with the person's own write through the daemon's non-queueing lock.

**Not verified:** a real Gitea. The probe's Gitea behaviour comes from the
1.25.4 source and the earlier `gitea-push-permission` live result (read-only
push 403, write push allowed, protected branch refused). It was not run
against Alder's Gitea or on the test server, because neither has a real Gitea
this run could use. The first live check is the KOKEILTAVAA line.

## Decisions for later review

1. **A read-only token is still accepted.** Alternatives: refuse it at
   connect. Why: refusing would break today's working fetch-only connections
   and the deliberate least-privilege choice. The issue asked for recognition
   ("tunnistetaan"), not refusal.
2. **The settings page checks each shown connection once by itself.**
   Alternatives: show push only after the person presses Tarkista, or have the
   list read the network. Why: without it, an existing read-only connection
   (Jari's on Birch) would look fine until a push failed. The daemon list
   stays network-free. The check is silent, one at a time, and yields to the
   person's own writes.
3. **`unknown` when the account has no repository it may push to on page
   1.** Alternatives: page through everything, or guess from the API's
   permissions. Why: the API's permission is the account's, not the token's,
   and one bounded page keeps the check within the request budget.
4. **A `public-only` token meeting a private repository also reads as
   `read_only`** (Gitea gives the same bare 403). The advice, to replace the
   token, is still right.
5. **Agent guidance** in `internal/daemon/host-context.md`: a 403 push with
   working fetch is most often a read-only token. The person checks and
   replaces it in `/settings/code-hosts`, and a token never goes into a URL
   or Git config.
