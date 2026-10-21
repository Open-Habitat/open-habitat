# Browser folder sharing removed

Removed the grant/picker UI and IndexedDB service, integration card, browser
request callback, Pi tool and per-process socket, browser/agent HTTP adapters,
CLI local-file commands, SSE event and agent schemas/generated types. Native
history, attachments and cloud-sync integrations retain their own authority.
The Pi SDK test now rejects a leaked `local_files` declaration. The agent socket
test rejects POST to the removed route. No migration/compatibility state remains.

OneDrive/Dropbox guidance appears on the integrations overview and their setup
intro; the host context suggests synced folders for incoming screenshots and
outgoing files such as email attachments. The same folder must sync on the
person's computer. Individual file attachments are unchanged.

## Verification

Working implementation based on 174e1b36, including removal commit 5639a480 and
the cloud-guidance change, checked with:

- `./scripts/test-web-fast.sh`: passed formatting, lint, TypeScript and Vitest.
- `OH_PORT_BASE=18674 ./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: 1 passed (picker/paste/drop, authenticated bytes/download and axe).
- Same command with `integrations.spec.ts`: 6 passed, including desktop/phone axe.
- Same command with `lab-composer-area.spec.ts`: 10 passed, including light/dark,
  desktop/phone attachment selection, dismissal/focus, draft retention and axe.
- `umask 077; go test -count=1 ./internal/daemon ./internal/gateway ./internal/cli ./test/browser-host`: passed; includes the pinned native Pi synthetic provider.
- `./scripts/test-focused.sh --area contracts`: generated drift and schema checks passed.
- `npm run build --prefix web`, `scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output .cache/folder-removal-package`, and `scripts/verify-release.sh --archive .cache/folder-removal-package/open-habitat-0.0.0-test-linux-amd64.tar.gz --json`: passed.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed.

Browser runs used Fleetrepo's warm synthetic Cedar guest, not real accounts or
separate UIDs. No full gate or deployment was run. This is not evidence of live
provider syncing or an actual model choosing to suggest cloud sync.

## Removed test coverage

The deleted local-files unit/Go/JS/browser cases distinguished unsafe basename
handling, request claims/completions, timeouts, cancellation, directory handle
restore/replacement and tool activation in older Pi loadouts. Those capabilities
and their dispatch paths no longer exist, so their tests are intentionally not
replaced. Journal contract subscription and duplicate/gap tests remain; ordinary
attachment transport/export and security cases remain. The former folder-panel
keyboard/geometry/axe cases now exercise single-file selection. The IMAP typing
regression retains real typing, focus, no-premature-login and page-error checks;
its browser-folder IDB/picker probes are removed with that service.

## Focused review and evidence

Reviewed the final code diff (ignoring only App provider-unwrapping indentation),
searched remaining feature names, and checked bridge removal at browser, gateway,
daemon, agent CLI and native Pi launch boundaries. No new authority or storage
was introduced. No additional findings require filing.

A disposable capture spec produced these paired synthetic-lab views and was
removed after use:

- [Integrations overview, desktop](evidence/integrations-1440.html), paired with
  `evidence/integrations-1440.avif`.
- [OneDrive setup, phone](evidence/onedrive-390.html), paired with
  `evidence/onedrive-390.avif`.

## Recovered command failures

The first Go run failed on an unused httptest import left after deleting the
browser reply test. Removed it and reran all four packages successfully
(`/var/tmp/oh-folder-go.log`, `/var/tmp/oh-folder-go-retry.log`).
The first evidence-only capture used an ordinary synthetic host, and the snapshot
helper correctly refused its missing lab marker. Retried using the lab fixture;
both widths passed. No live data was captured. Working evidence is under
`/var/tmp/oh-folder-evidence`; the retained pairs above are the delivery evidence.
