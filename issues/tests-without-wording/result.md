# Wording cleanup implemented; final ordinary suite blocked

Run: `01m5eg8e8gzn1wncxd51ves1jj`, based on `d71151f1`.

Migrated both shared helpers to stable hooks/native state, scoped the terminal-refusal status to its toast, and replaced two storage-copy assertions plus the translated Git-badge locator. Added only production test/state attributes. No cases removed or timeouts increased. Also repaired two observed harness races: empty-thread geometry now polls the stable empty marker, and title regeneration captures the native upstream reply before navigation can discard it. Self-review and `git diff --check` passed.

## Remaining text checks

AST sweep of `web/tests/**/*.ts[x]` and `web/src/**/*.test.ts[x]`: **254 calls remain** — 59 `getByText`, 64 `toHaveText`, 131 `toContainText`; **zero accessible-name role locators**. Retained checks cover supplied/native messages, Markdown/tool output, repository/file/branch/commit names, identity and disclosure boundaries, device codes, credential redaction, version values, and structured counters/timestamps. Fixture object `name` properties are data, not locators. Also inspected `findByText`, `queryByText`, and title/label locators; retained text is supplied content or a non-disclosure assertion.

## Final evidence

All browser commands used the ordinary Fleetrepo route to Cedar, `umask 077`, disk-backed TMPDIR; host-backed synthetic evidence only.

| Command | Result | Command seconds |
| --- | --- | ---: |
| `./scripts/test-web-fast.sh` | 81 files / 471 tests passed | 22 |
| `cd web && npx playwright test` | **299 passed, 2 failed**, 3 opt-in capture skips | 146 |
| `npx playwright test --config playwright.lab.config.ts` | 62 passed | 34 |
| `npx playwright test browser-shell.spec.ts --repeat-each 10` | 90 passed | 122 |

Final ordinary failures are in unchanged `server-version-reload.spec.ts` (version row disappears during fixture restart) and `mutation-layer.spec.ts` (`route.abort: Route is already handled!`). Earlier stress checks also exposed reconnect/recheck races. Filed untriaged, without a lane, as @phenomenally-various-jail. Unsuccessful experimental release/reconnect fixes were fully reverted. The issue stays **open** and this worker does **not merge** because the required ordinary suite is not green.

Final logs: `/var/tmp/wording-delivery-{fast,ordinary,lab,shell-repeat}.log`. Complete retry/tool-failure inventory: `/var/tmp/wording-validation-inventory.md` (with linked diagnostic inventories). A temporary Cedar admission refusal recovered through the existing passive guard; no local bypass or infrastructure changes. Issue doctor and project-view validation passed with existing image advisories. No full gate, live provider, or distinct-UID claim.
