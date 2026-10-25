# Native push qualification: Birch → Alder Gitea

Passed on 2026-10-25, run `01m5s8hzd1rp5jcx8vypqhce3h`. No product code,
release, host upgrade, UI or credential-store change was needed.

## Authority and target

Jari's two 2026-10-25 Decisions authorize this test and temporary replacement,
rotation, revocation and disconnect of his Birch connection. Only disposable
private `jari/habitat-access-test` was created or written. No push to another
repository was attempted. The repository remains in place, with harmless
README content and one empty test commit, and its clone remains at
`/home/maintainer/src/habitat-access-test`.

The previous attempt `01m5s82fmtj4a48ee0c0ab34tc` stopped before setup because
its brief required preserving the existing connection. Its commits were
adopted, then this result superseded the blocked account. That run's nonsecret
before/after evidence remains under
`/var/tmp/agent-keep/gitea-birch-push-01m5s82fmtj4a48ee0c0ab34tc/` on Alder.

## Installed boundary

- Birch: Open Habitat **0.1.0-pilot.11**, revision
  `8019de3c4f98c6e9a696b703efca339adc2d47a2`; real person `maintainer`,
  kernel UID **32000**. Daemon requests ran as gateway UID **31000** through
  `/run/open-habitat/users/maintainer/daemon.sock`, HTTP/1.1, Host `unix`.
- Installed tea **0.16.0**, Go **1.26.6**, SDK **v1.2.0**, at
  `/opt/open-habitat/current/payloads/integrations/runtime/bin/tea`.
  Git **2.43.0**, Pi **1.3.0**.
- Alder Gitea **1.25.4**, `https://alder.example-tailnet.ts.net`; public CA,
  verified TLS, no trust bypass, CA installation or network change. See
  [read-only proof](../gitea-readonly-acceptance/result.md#real-provider-alder-gitea-via-birch).
- Native tea login `habitat-adb949f41a55-1`, account `jari`, connection
  `gitea_ab9f4bb6f66c6964fd0ca424`. Connect/replace/check/disconnect used the
  installed daemon's `/api/v1/integrations/gitea`. The adapter reads/writes
  tea's one native file; Git uses the installed absolute Habitat helper.
  No token was passed in an argv, remote URL or Git config.

## Scopes, policy and observations

All PATs were generated on account `jari` through the Gitea admin CLI, with
`--raw` captured directly into mode-0600 files in the private evidence directory.

| Grant | Exact scopes | Use |
|---|---|---|
| `habitat-test-ro1`, `habitat-test-ro2` | `read:user,read:repository` | installed read-only lifecycle and denied push |
| `habitat-test-write` | `read:user,write:repository` | native allowed/denied branch push |
| `habitat-test-setup` | `write:user,write:repository` | repository creation API only; never connected to Habitat; immediately revoked |
| `habitat-birch-readonly-3` | `read:user,read:repository` | final working connection |

Gitea's `POST /user/repos` requires `write:user`: the push-test PAT could not
create a repository (403). The short-lived setup-only PAT supplied that scope
for the explicitly authorized repository creation. This did not widen the grant
used to qualify Git push or change the connector's authority.

`main`, `push-test` and `protected` initially pointed to harmless README commit
`9f67e50c0f41aed46dfebae3b1523ebe8383935b`. `push-test` has ordinary owner
permissions, no protection. The `protected` rule has `enable_push=false`,
`enable_force_push=false`, empty push allowlists and
`block_admin_merge_override=true` (Gitea's returned spelling).

| Operation | Actual result |
|---|---|
| installed daemon clone with read-only PAT | job `dcfa8f420b29f7c51c8cf2e498b4fc19`, `confirmed`; private HTTPS remote, no userinfo/token |
| daemon workspace fetch / minimal shell fetch / installed tea repository list / Pi fetch | passed; same native grant, no SSH agent or token environment |
| replace ro1 → ro2 | 200 `written`, API `ok`; existing clone fetch passed without reconfiguration |
| revoke ro2 upstream | check `token_rejected`, catalog failed `token_rejected`, shell fetch exit 128 authentication failure |
| disconnect revoked grant | 200; clone and commit history retained; fetch exit 128, no password available |
| reconnect ro1; commit on `push-test`; push `HEAD:refs/heads/push-test` | **denied**, exit 128, HTTP 403 `Forbidden` |
| replace with write PAT; fetch and same push | **allowed**, exit 0; server `push-test` now `41634c440c2036d9616aa337a903108fd4887336` |
| same write PAT, push `HEAD:refs/heads/protected` | **denied**, exit 1, pre-receive hook: `Not allowed to push to protected branch protected`; server branch still original commit |
| replace with final read-only PAT | 200 API `ok`; check, complete catalog, shell fetch and daemon workspace fetch passed |

Shell Git ran with `env -i`, mapped HOME/XDG, `/usr/bin:/bin`, and
`GIT_TERMINAL_PROMPT=0`; only the native helper supplied credentials. Pi's
installed tool environment also fetched successfully. These are native Git
checks, not a browser push feature or a repository-specific PAT confinement claim.

## Final state and credential audit

Jari has the working read-only `habitat-birch-readonly-3` connection. SQLite
readback confirms **zero** `habitat-test-%` or `habitat-birch-readonly-2` tokens.
Only `habitat-birch-readonly-3` remains among this test's connection/token names;
other pre-existing token names/scopes were read back without changing them.
The final tea file is mode **0600**, owned by UID **32000**. Active setup
material is removed from the evidence directory after auditing, leaving tea as
the only retained copy of the final PAT.

Byte-searches for every newly generated PAT and its Basic-authorization encoding
found no matches in the clone's config, remotes, effective Git configuration,
reflogs, daemon/gateway journal since 10:09 UTC, Gitea container logs since that
time, or local nonsecret evidence. Seven Birch files plus command/journal
projections and 39,366 bytes of Gitea logs were scanned. The native tea file is
intentionally excluded from leak scanning: it is the authorized secret store.
Token-file modes were all 0600. No raw logs or private repository inventory are
committed.

Nonsecret receipts and disposable experiment scripts are under
`/var/tmp/agent-keep/gitea-birch-push-01m5s8hzd1rp5jcx8vypqhce3h/` on Alder.
Key files: `push-*.log`, `branch-*.json`, `final-branch-*.json`, `protection.json`,
`browser-fetch-*.json`, `catalog-*.json`, `credential-audit-*.json`,
`token-cleanup.txt`, `versions-tls.txt`, `pi-fetch-events.jsonl` and
`focused-tests-retry.log`.

## Validation and focused self-review

After installing the repository-local Pi SDK test fixture, the focused command
passed: `go test ./internal/nativegitea ./internal/cli
./internal/daemon/integrations ./internal/daemon -run 'Gitea|Credential' -count=1`.
The integrations package has no matching standalone tests; the daemon tests
exercise the adapter/provider boundary. Self-review compared server branch SHAs,
actual exit codes and fixed failures, token scopes/readback, inventory IDs and
native-store observations. Expected denial is not counted as a tool failure.
No production code changed, so neither a clean gate nor independent LLM review
was required for this evidence-only run. No UI verdict is claimed and
`gitea-readonly-acceptance` remains `testing`.

## Tool/sub-workflow failures (all recovered or advisory)

- Discovery: local `sudo podman` required a terminal; rootless `podman` was the
  correct route. Guessed source/schema paths and one global skill path were
  absent; scoped reads located the real paths. `python` was absent; used
  `python3`. Initial Birch `ls` probes met private/absent paths; sudo read-only
  inspection located the socket and installed tools. `tw doctor` warned that
  no seat was attached; no seat was needed.
- Repository creation with the exact push-test grant returned 403 requiring
  `write:user`; recovered with the setup-only grant above, revoked immediately.
- One lifecycle shell command hit its 60-second harness timeout after both push
  outcomes were already recorded. Final replacement also encountered a provider
  timeout (422). Native state was observed before completing final replacement
  through a managed process. A restore process was deliberately stopped before
  its accidental import of the lifecycle script could rerun it; a standalone
  restore then passed. No blind replay of the push occurred.
- One SQLite read returned `database is locked`; retry with a longer timeout
  passed. Final catalog initially reported `unreachable`; a fresh full audit
  passed with complete catalog and daemon fetch. These are observed transient
  provider failures, not suppressed successful results.
- Pi initially waited for the SSH stdin EOF, not a model response. Closing that
  stdin completed its successful fetch; the structured follow-up uses `ssh -n`.
- The first broad focused-test regex included Pi credential tests without their
  required local SDK fixture. `npm ci --prefix internal/daemon/pi-device-test
  --ignore-scripts` repaired it; the same complete test command then passed.
  npm reported peer/deprecation warnings and five dependency vulnerabilities;
  these advisory install warnings did not fail the focused tests and no
  dependency changes were made.

The commands/receipts named above preserve the failures and final results.
No required proof remains failed or incomplete in the push qualification.
