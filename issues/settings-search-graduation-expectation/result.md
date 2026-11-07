# Result

Personal settings search now asserts that an administrator's own API keys appear and the server key does not. The graduated server area has no search field, so there is no server-search expectation to move. Removed the obsolete administrator-result settling poll in favor of waiting for the second personal result. Arrow preview/wrapping, active descendant, Enter focus, history preservation, Esc, folded-row landing and narrow-layout coverage remain intact.

## Validation

Tested on base `6fd2c9413` plus this issue's test-only diff, on Birch with umask 077, disk-backed TMPDIR `/var/tmp/oh-ssearch.AO3a7Z`, `OH_PORT_BASE=16400`, `OH_BROWSER_WORKERS=2`:

- Installed web and Pi fixture dependencies from their lockfiles.
- `./scripts/test-focused.sh --area browser --spec settings-search.spec.ts`: 5 passed.
- `./scripts/test-focused.sh --area browser --spec settings-experimental.spec.ts`: 3 passed.
- `./scripts/test-focused.sh --area web`: static checks and 180 test files / 1372 tests passed.
- Focused self-review: no product changes; the negative key assertion catches accidental reintroduction of server results. Existing keyboard and focus assertions are retained. No authority/session/contract changes.

Browser evidence is host-backed synthetic, not live-server or distinct-UID evidence. No full gate or deployment was run. Logs are in the TMPDIR above. The initial invocation supplied two `--spec` flags; only the last ran, so the search spec was run separately and passed.

## Decisions for later review

None: this restores the already approved personal/server separation, without changing product behavior.
