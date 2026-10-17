# Trace inspector result

Implemented `scripts/inspect-trace.sh` as a POSIX shell entry point with embedded
Python standard-library ZIP/JSON handling. It has `--help`, `--json`, classified
exit codes, strict single-input selection, safe archive member validation,
fresh private `mktemp -d` extraction and no deletion or viewer launch. Python
avoids a dependency on jq and validates traversal/symlink members before writing.
Linux refuses tmpfs/ramfs extraction parents; the default is `/var/tmp`.

## Real failing lab trace

Tested from this run's checkout based on `156fd921` (the exact base is recorded
by git; all script and documentation changes were present when checked).
A temporary `web/tests/lab-trace-inspect.spec.ts` imported `test` and `expect`
from `./lab-host`, opened `/workspaces`, emitted
`console.error('trace-inspect console probe')`, fetched
`/trace-inspect-missing-resource`, and asserted that
`getByText('trace-inspect intentionally absent')` was visible with a 500 ms
timeout. This is an intentional failure, not a product regression. The
scratch spec was removed after capture; no failing test is added to the suite.

```sh
TMPDIR=/var/tmp OH_PORT_BASE=17600 \
  PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" \
  web/node_modules/.bin/playwright test \
  --config web/playwright.lab.config.ts lab-trace-inspect.spec.ts \
  --trace on --workers 1
./scripts/inspect-trace.sh web/test-results
./scripts/inspect-trace.sh --json web/test-results
```

Playwright built fresh production assets and the synthetic lab host, ran
Chromium, and failed at the intended assertion (exit 1). It produced
`web/test-results/lab-trace-inspect-trace-inspector-intentional-lab-failure/trace.zip`.
Both inspector invocations succeeded (exit 0). The summary contained:

- failed action `Expect "toBeVisible"` with the absent locator and timeout;
- `trace-inspect console probe`;
- HTTP 404 for `/trace-inspect-missing-resource` and the synthetic unauthenticated
  page's HTTP 401 requests;
- fresh retained paths `/var/tmp/oh-trace.5cKWOcQV` (text run) and a distinct
  directory for the JSON run, plus the local `playwright show-trace` command.

The archive and captures remain ignored local artifacts, not repository data.
This proves inspection of a real Playwright failing trace in the synthetic lab,
not provider behavior, live-host operation or separate-UID isolation. The GUI
viewer command was printed but not launched.

## Other checks

- `python3 scripts/test-inspect-trace.py`: four boundary tests passed, including
  summary fields, last-five network errors/transport failure, paths with spaces,
  unique extraction, traversal/symlink rejection with an untouched sentinel,
  invalid/ambiguous inputs, corrupt ZIP/JSONL and missing dependency exit codes.
- `sh -n scripts/inspect-trace.sh`: passed.
- `python3 scripts/validate-project-view.py`: passed, 34 pages/navigation entries.
- `git diff --check`: passed.
- `issuectl doctor --json`: completed successfully; existing unrelated repository
  warnings were not changed. Full gate not run for this isolated helper change.
