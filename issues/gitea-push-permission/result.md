# Birch / Alder qualification attempt (2026-10-25)

**Blocked before setup or push.** Run `01m5s82fmtj4a48ee0c0ab34tc`.
No product code changed, no test PATs or repository were created, and no push
was attempted. The issue remains `in-progress`, not done.

## Authorization and target

Jari's 2026-10-25 Decision authorizes private `jari/habitat-access-test`, test
branch `push-test`, protected branch `protected`, and separate test PATs:
`read:user,read:repository` and `read:user,write:repository`. This is not
permission to change his existing connection, create users, or use other repos.

## Blocking observation

Birch runs Open Habitat `0.1.0-pilot.11`, revision
`8019de3c4f98c6e9a696b703efca339adc2d47a2`, generation
`f68c39dbeea8a675f702023f9578ddbd5ed5ea0d6418d602e43dea3d2413811f`.
Installed tea is 0.16.0 (Go 1.26.6, SDK v1.2.0), at
`/opt/open-habitat/current/payloads/integrations/runtime/bin/tea`.
The actual person is `maintainer`, kernel UID 32000; the gateway is UID 31000.

Secret-free native `tea logins ls --output json` and the installed daemon's
`GET /api/v1/integrations` (gateway UID, Host `unix`, HTTP/1.1) show:

- native name `habitat-adb949f41a55-1`, user `jari`, default false;
- base `https://alder.example-tailnet.ts.net`;
- connection `gitea_ab9f4bb6f66c6964fd0ca424`, owned PAT, unambiguous,
  Git helper registered.

At the installed revision, `internal/nativegitea/lifecycle_linux.go`'s
`Store.Connect` refuses a different PAT for that owned login (`ErrExists`)
and also refuses another entry for the same canonical base/account.
`logins.go` marks manually duplicated base/user entries ambiguous. Replacement
is the explicit route. Thus the required read-only rotation/revocation/
disconnect and write-token test cannot run on this daemon while leaving Jari's
connection untouched. No conflicting connect or replacement was attempted.
An isolated HOME would not prove his installed running daemon path and was
not silently substituted for it.

## Preserved state

Before/after daemon Gitea projections and native tea projections compare equal.
Tea config remains UID 32000, mode 0600, size 397, inode 9449172,
mtime/ctime 1792922243. Git config remains UID 32000, mode 0600, size 454,
inode 8912952, mtime/ctime 1792922243. No secret was printed or inspected;
only the native secret-free projection and filesystem metadata were read.

Alder's SQLite query after inspection reports **zero** `uid=1` tokens with
names matching `habitat-test-%`. No revocation was needed. No test repository
was created by this run. Existing repositories were not modified.

Local nonsecret evidence is in
`/var/tmp/agent-keep/gitea-birch-push-01m5s82fmtj4a48ee0c0ab34tc/` on Alder
(`connection-before.txt`, `connection-after.txt`, `state-before.txt`,
`state-after.txt`, `test-token-count.txt`).

## Unproven / next decision

Provider TLS/CA and server version, catalog completeness, clone/fetch, rotation,
revocation, retained clone, read-only push denial, write push success, protected
branch refusal and token-material leak scanning were **not exercised** here.
No acceptance boxes are checked. Focused self-review confirmed that projections
and metadata match, the installed source rejects a second same-account login,
and no result is presented as provider qualification.

Recommendation: authorize a separate isolated test HOME/daemon under the same
kernel UID using the installed binary, explicitly accepting that this is not the
existing browser daemon. Otherwise the test needs permission to temporarily
replace Jari's connection, which this worker does not have. No release, upgrade,
new user, UI or adapter change is warranted merely to bypass this boundary.

## Tool/sub-workflow failures

- Initial discovery guessed `/opt/open-habitat/tools`, absent tea fallback,
  and several source globs/paths that do not exist. A non-root find also met
  the private staging directory. Scoped inspection with sudo located tea and
  the correct source files; these are recovered discovery misses.
- Initial daemon curl used Host `localhost` (403), then GET on the mutation
  route (400). Correct Host `unix` and `GET /api/v1/integrations` succeeded.
- Initial jq assumed a `.data` wrapper, giving a null projection and then a
  keys error. The list endpoint is a top-level view; corrected projections
  succeeded and were compared before/after.
- Initial SQLite read met `database is locked`; retry with `.timeout 3000`
  succeeded and was repeated, both counts zero. No database write occurred.
- Required end-to-end provider/push workflow is incomplete because of the
  connection-preservation authority conflict, not a successful test. No gate
  or independent review was required for this documentation-only attempt.

These are disclosed rather than used to justify merge. The worker submits a
terminal failure report, preserves its commits, and does not call run merge.
