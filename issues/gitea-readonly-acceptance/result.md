# Result: Gitea two-UID isolation and installed read-only acceptance

Everything that can be proved without Jari is done. The two-kernel-UID proof is
now part of `scripts/test-repo-catalog-uids.sh`, and the installed read-only
path has passed against a real Gitea server set up for this test. Two things
remain for Jari: the product verdict on the installed UI, and acceptance
against Alder's real Gitea. The issue stays open in `testing` until he has done
both.

## Proof levels

The four levels are separate claims. A lower level does not prove a higher one.

1. **Unit fixture (same UID).** Shipped before this issue: `internal/nativegitea`,
   `internal/daemon/integrations` and `internal/daemon/gitea_*_test.go` against
   `giteafake`. Re-run here: `go test ./internal/daemon -run 'Gitea|Workspace.*Fetch|Remote'`
   and `go test ./internal/cli -run Gitea`, both green.
2. **Host-backed browser (same UID).** The `gitea-production-ui` specs against
   a synthetic Gitea, with Storybook fixtures. This proves the UI flows only and
   is not isolation evidence. This issue changed no UI and did not re-run them.
3. **Real UIDs and runtime (new): `TestGiteaDistinctUIDs`.** Run with
   `./scripts/test-repo-catalog-uids.sh`, which passes. The test runs in a
   disposable networkless Ubuntu 24.04 container image with Git
   (`localhost/open-habitat-repo-uids:ubuntu-24.04-git`). It uses three kernel
   UIDs: agent-a, agent-b and the gateway. Each daemon runs as its own person
   behind the real `transport` server and only answers the gateway's kernel
   peer. The test uses the production pieces throughout: `NewGitea` with
   `nativegitea.NewClient()` (system trust only), `NewCloneJobs(...).WithGitea`,
   `RepoObserveHandler`, `WorkspaceGitFetchHandler` and the catalog routes.
   Real Git calls the native helper. The synthetic Gitea's CA is added to the
   container's OS bundle, as an operator would do. agent-a holds ada's PAT and
   agent-b holds bob's. The test proves:
   - each tea file is owned by its person with mode 0600 and holds only that
     person's PAT. Each person's lists and repository sources are their own,
     and a forged identity header changes nothing;
   - agent-b's daemon refuses agent-a's connection ID for check, replace,
     disconnect and clone (`connection_changed` /
     `gitea_connection_unavailable`). This includes a collaborator repository
     that bob's own PAT could read. agent-b's tea file stays byte-identical
     and nothing is cloned into agent-b's home;
   - agent-b cannot see, cancel or stream agent-a's running clone job
     (`job_not_found`, 404). agent-a's own disconnect is refused while that
     clone runs (`clone_running`), and agent-a's cancel removes the leftover;
   - clones belong to their person's UID, authenticate as their person's Gitea
     account, and hold no token in `.git/config`;
   - fetch takes the same grant through the browser route and through the
     person's own shell (`git pull`). agent-b's own Git, asking for ada's private repository,
     presents bob's grant and is refused by Gitea;
   - the helper refuses agent-b with agent-a's `HOME`. It also refuses agent-b
     with a readable home owned by agent-a, even when the tea directory and
     file inside are agent-b's own (exit 2, no `password=`); the same layout
     with agent-b's own home succeeds. agent-b's `ls` of agent-a's home and
     clone and `cat` of the tea file and the clone's config are denied, and the
     same reads work as agent-a;
   - agent-b's dial of agent-a's socket fails with permission denied. agent-a
     itself and root can connect to that socket file, but the daemon does not
     serve them; the foreign workspace fetch is exactly `404
     workspace_unavailable`;
   - after revocation at Gitea, check reports `token_rejected`, the source
     fails with `token_rejected`, and shell fetch fails, while agent-b is
     unaffected. Replace rewrites only agent-a's file, and the existing clone
     fetches again with the new PAT;
   - disconnect removes agent-a's login and helper and keeps the clone with its
     history; a later fetch has no credential. agent-b's connection, helper,
     list and fetch are unchanged;
   - no reply carries a token.

   The test helper (`giteaHelperForTest`) now exits 2 on unreadable tea state,
   as the product CLI does, instead of 0. It previously returned an empty
   answer that could not be told apart from "no match".
4. **Real provider, installed host.** Detailed below. The connector passed
   against a real Gitea. Jari's review is still open.

## Real provider acceptance (2026-10-25, test server)

**Installed product.** `open-habitat-test-nbg1` running release
`ea553e4ca5c00a96905650bf9b828712719b6e59` (the `gitea-runtime-qualification`
release with tea 0.16.0 in `tools.tea`). The helper is registered as
`/opt/open-habitat/current/open-habitat gitea git-credential` with
`useHttpPath = true`.

**Server.** Upstream Gitea **1.25.4**, chosen because Alder's household Gitea
reports that version on its public `/api/v1/version`. Nothing else was read
from or done on Alder's Gitea. The test used the static binary
`gitea-1.25.4-linux-amd64`, SHA-256
`a3031853e67c53714728ef705642c9046a11fb0ea356aff592e23efe6114607d`. That
digest matches upstream's `.sha256`, and the file carries a good signature
from Teabot `7C9E68152594688862D62AF62D9AE806EC1592E2`. The server runs as the
transient unit `oh-gitea-accept.service`, under the system user
`oh-gitea-accept`, with SQLite in `/var/lib/oh-gitea-accept`. It listens only
on `https://127.0.0.1:3443` and has registration and SSH disabled and
`REQUIRE_SIGNIN_VIEW` set. `[api] MAX_RESPONSE_ITEMS = 4` forces pagination.

**Accounts and data.** All throwaway:

- `habitat-a` owns `harmless-notes`, `filler-1` to `filler-5` and an empty
  repository `empty-one`, and is a member of the read team of
  `acceptance-org/org-notes`;
- `habitat-b` owns `b-shared` (habitat-a has read access as collaborator) and
  `b-secret`;
- an admin account was used for setup only.

All repositories are private and hold only README text.

**TLS and CA.** Throwaway P-256 CA "Open Habitat disposable Gitea acceptance
CA", SHA-256 fingerprint
`79:E8:C8:3F:8C:57:50:56:A3:FE:C8:97:90:F6:A2:E5:EA:AC:BD:7A:90:9C:FF:41:A7:3B:18:43:4F:AC:DA:DB`.
The server certificate is valid for `IP:127.0.0.1` and expires after 30 days.
Before the CA was trusted, connect answered `tls_untrusted` (422) and nothing
was written. The CA was then installed in the OS trust with
`/usr/local/share/ca-certificates/oh-gitea-accept.crt` and
`update-ca-certificates`, and maintainer's daemon was restarted. A daemon
loads the store once at start; Git and tea read it on every run.
`docs/operations.md` now tells the operator to restart.

**Tokens.** `read:user` + `read:repository`, generated with
`gitea admin user generate-access-token`. They are kept only in root-only
`/root/oh-gitea-accept.Ryx25bnV/tokens/` on the test server.

Observed through maintainer's installed daemon socket, as the
`open-habitat-gateway` UID:

| Check | Observation |
|---|---|
| connect `read:user,read:repository` | 200, `api: ok`, `git: registered`; tea file 0600 maintainer |
| connect `read:repository` only | 422 `insufficient_scope`, nothing written |
| connect `read:user` only | **200 `api: ok`**; check also `ok`; list source `failed`/`insufficient_scope`. Filed as `starkly-cultured-sign` |
| connect `read:user,write:repository` | 200 `ok`: the connector cannot see token scopes (see decisions) |
| garbage token / `http://` / `169.254.169.254` / `localhost` (cert is IP-only) | `token_rejected` / `invalid_address` / `forbidden_destination` / `tls_untrusted` |
| repository list | 9 repositories (own, empty, collaborator `habitat-b/b-shared`, org `acceptance-org/org-notes`), `b-secret` absent, `complete: true`; Gitea log shows `/user` then `/user/repos?page=1..4&limit=50` (4+4+1, empty page 4) |
| clone job `harmless-notes` | `confirmed`; checkout maintainer 0700; `.git/config` has `username = habitat-a`, no token |
| browser fetch route after an upstream commit | 200, `behind: 1`, the incoming commit listed |
| shell (`env -i`, maintainer) | `git pull --ff-only` ok; `ls-remote` of org and collaborator repos ok; `b-secret` "not found" |
| tea 0.16.0 as maintainer | `tea logins ls` shows the product-written login `habitat-2c7474cc9626-2`; `tea repos ls --login …` lists the repositories (tea's own first page) |
| Pi 1.3.0 as maintainer (`pi -p --tools bash`, his default model) | `git fetch origin` and `git ls-remote …/org-notes.git` both exit 0 through the helper. A first prompt that also asked for the forbidden repository was refused by the model provider's safeguard before any tool ran |
| revoke `oh-ro-a1` at Gitea | check `api: token_rejected`; source `failed`/`token_rejected`; shell fetch "Authentication failed" |
| replace with habitat-b's PAT | 422 `account_mismatch`; tea file hash unchanged |
| replace with new habitat-a PAT | 200 `ok`; old token gone from the file; list `ok` (9); existing clone fetches without reconfiguration |
| second connection on the same base, then its disconnect | helper section kept while habitat-a's login remains |
| disconnect | 200; tea `logins: []`; helper section removed from `~/.gitconfig`; clone and history kept, still listed as a workspace (no `gitea_origin`); fetch now has no credential; the PAT stays valid at Gitea (local disconnect only) |
| second real UID `ville-svg` (read-only probes only) | its daemon: Gitea list empty, maintainer's connection ID `connection_changed`, clone `gitea_connection_unavailable`, workspace ID `workspace_unavailable`; as that UID: tea file and clone `Permission denied`, helper with maintainer's `HOME` exit 2, his socket unreachable |
| maintainer's own UID on his daemon socket | connection reset (only the gateway peer is served) |

ville-svg's home and tea state were not written. Afterwards maintainer's test
home was put back as it was before: the tea directory and the
`harmless-notes` clone are removed, and the helper sections are gone from
`~/.gitconfig`.

**Not proved on the real server.** A clone held long enough to try a disconnect
and cancel while it runs, because the small repositories finish at once. This
is proved under real UIDs in level 3 only. Push was not attempted, as the issue
requires.

## Review

Independent `/llm-review` of the test, script, operator note and this file
(finder GPT-6 Astra, one call; report in `history/review-gitea-readonly-acceptance.md`,
local only). Its four findings were all confirmed locally and fixed: directory
reads that failed with `EISDIR` regardless of permissions, an exposed-home
fixture that failed on lock creation and file mode before the owner check, a
socket probe that could not tell a refused dial from a closed connection, and a
foreign fetch check that accepted any non-200. No verifier was called because
each finding was settled by reading the code and rerunning the test. Production
code did not change, so no credential or daemon code needed review.

## Gate

The clean gate (`./scripts/ci-local.sh --clean --json`) on tree `6ad204ed`
passed Go, contracts, web checks and packaging. The browser phase had one
failure out of 377: `browser-conversation.spec.ts:2036`, a spec this change
does not touch, while the host load average was about 9. Run alone, that spec
passed 4 times out of 4. The recurrence is filed as `massively-teeny-education`.
No gate receipt was written.

## Decisions for later review

- **Upstream binary instead of a container.** The test server has no container
  runtime. Installing one for a single test seemed worse than running the
  pinned upstream binary in a transient unit with its own system user. Both
  are verified by digest and signature.
- **Gitea 1.25.4.** Same version as Alder's household Gitea, so this run
  predicts the real acceptance as closely as possible.
- **maintainer's test account as the installed person.** The test server has
  no other account of Jari's, and new accounts are created only by a browser
  sign-in. The connection, clone and tea file were removed afterwards.
  `open-habitat-daemon@maintainer` was restarted once, so that the daemon
  would load the new CA.
- **A token's extra scopes cannot be seen.** "Read-only" describes the
  connector: it never pushes and offers no write surface. The grant itself is
  whatever the person created, and Gitea exposes no token scopes to the token.
  A `write:repository` PAT is accepted, and Git in the person's shell could push
  with it. This matches ADR 0031's limits, and the connect dialog asks for
  read-only scopes.
- **The `read:user`-only finding is filed, not fixed here.** Fixing it changes
  the connect and replace credential path and the synthetic Gitea's scope
  model, and needs its own review. The list already names the failure, so the
  person is not misled for long. Filed as `starkly-cultured-sign`.

## Left for Jari

The disposable Gitea is still running for this review. Nobody else is
connected to it.

1. **Product verdict on the installed UI (test server).** Get the review token
   onto your clipboard from Alder:
   `ssh -i ~/.ssh/open-habitat-test-hetzner -o UserKnownHostsFile=~/.ssh/known_hosts_open_habitat_test_hetzner root@203.0.113.10 cat /root/oh-gitea-accept.Ryx25bnV/tokens/jari | tw clipboard copy -`
   (habitat-a, `read:user,read:repository`). Then on
   https://open-habitat-test.example.test:
   1. Asetukset › Integraatiot › Gitea: address `https://127.0.0.1:3443`, paste
      the token, and connect. The card should show habitat-a as connected.
   2. Uusi työtila: the 9 Gitea repositories appear beside GitHub's, without
      `b-secret`.
   3. Clone `habitat-a/harmless-notes` and fetch in the workspace. In the
      browser shell, `git pull` and
      `/opt/open-habitat/tools/tea-v0.16.0/tea repos ls --login <name shown by tea logins ls>`
      should work.
   4. Disconnect. The clone stays and fetch no longer authenticates.

   Judge the connect dialog and the common list as the accepted connect-riff
   and workspace-import round 3 designs.
2. **Alder's real Gitea.** This needs a route from the test server to Alder's
   Gitea, and possibly its CA in the OS trust. Both are operator prerequisites
   that this run did not set up. On a host that has the route, create a PAT on
   your own account with `read:user` + `read:repository`, connect it in the
   same dialog, and clone and fetch a harmless private repository (not the
   Fleetrepo repository). Check that the list's own, organisation and
   collaborator rows are complete. Then replace the token, revoke it in
   Gitea's settings, and disconnect.

**Teardown afterwards** (root on the test server):
`systemctl stop oh-gitea-accept; userdel oh-gitea-accept; rm -r /var/lib/oh-gitea-accept /opt/oh-gitea-accept /root/oh-gitea-accept.Ryx25bnV; rm /usr/local/share/ca-certificates/oh-gitea-accept.crt; update-ca-certificates --fresh; systemctl restart open-habitat-daemon@maintainer.service`.
The transient unit does not survive a reboot. After a reboot, start it again
with the `systemd-run` line from `setup.sh` in that directory.
