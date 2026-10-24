# Result: connected Dropbox showed "Tilaa ei saatu selville"

## Live cause

The Dropbox login works, but the account's **first sync was killed by a release
restart and never finished**, and the status check had no state for that
combination, so it fell through to `unknown`.

Evidence from the test guest (metadata, unit state and journal only; no file
contents or token values read), 2026-10-24 ~08:00 UTC:

- The tool path is not the cause. `integrations.json` `tools.rclone` is
  `/opt/open-habitat/tools/rclone-v1.71.2/rclone`, root:root 0755 with root-owned
  ancestors, and the daemon is already running that binary for OneDrive bisync.
  The provider is available, and `maintainer@example.org.conf` exists, mode 0600.
  rclone rewrote the file at 2026-10-24 06:18 UTC when it refreshed the token
  during a status `about` call, so the login is accepted.
- `~/.config/rclone/open-habitat-dropbox/bisync/maintainer@example.org/` holds
  only `…path1.lst-new`, `…path2.lst-new` (2026-10-23 04:20:48 UTC) and a `.lck`
  last refreshed at 04:27:48. There are no committed `.path1.lst`/`.path2.lst`
  listings, so `SyncCommand` is not ready and the daemon cgroup has no Dropbox
  bisync loop (only the OneDrive one).
- Journal of `open-habitat-daemon@maintainer`: Dropbox was removed and signed
  in again at 04:19:59–04:20:19 UTC on 2026-10-23, and the initial `--resync`
  started. At 04:28:31 systemd stopped the daemon for a release
  (`Stopping open-habitat-daemon@maintainer.service`) and the pass died with it.
  Ordinary restarts deliberately never resync, so nothing resumed it.
- `dropbox.Check`: when `rclone about` succeeds but the listings are missing, the
  state stayed `StateUnknown`, which the card shows as "⚠ Tilaa ei saatu
  selville". The 10.53 local screenshot (07:53 UTC) is a normal check of that
  state. A release restarted the daemon again at 07:54.

## Fix

- A file service whose login the tool accepts but whose first native pass has
  no committed listings now reports `sync_failed` with the new contract failure
  `initial_sync_incomplete` (`signedInState` in `catalog_linux.go`). This
  applies to Dropbox and to Google Drive, which had the identical fall-through.
- The catalog no longer erases an entry's own `failure` outside an initial pass.
- The card says "Ensimmäinen synkronointi jäi kesken" and "Kirjaudu uudelleen ja
  valitse synkronointi, niin ensimmäinen synkronointi tehdään loppuun. Jo
  kopioidut tiedostot säilyvät." `sync_failed` already shows "Kirjaudu
  uudelleen", and that sign-in already re-offers the missing initial choice when
  the listings are not ready (`relay_linux.go`, `needChoice`).
- Tests: `TestDropboxInterruptedInitialSyncIsNamed` reproduces the live
  directory (only `-new` listings plus a lock). Against the old `Check` it fails
  with `state:unknown`, and after the fix it reports
  `sync_failed`/`initial_sync_incomplete` through the browser API and `ok` once the
  listings are committed. The Google check test asserts the same for Drive. A
  component test covers the card text and the sign-in button.

Jari's account itself was not touched: completing the sync is his sign-in and
choice. The stale lock is not an obstacle, because bisync runs with
`--max-lock 2m` and treats an expired lock as stale.

## Decisions for later review

- **Named state rather than automatic resume.** An interrupted initial pass is
  reported and left for the person to restart by signing in again. It is not
  resumed automatically after a daemon restart. A resume is a `--resync` union,
  and if files were deleted meanwhile it could bring them back. The existing
  rule that ordinary restarts never resync is a safety choice. The alternative
  is to resume an initial pass that was explicitly approved and interrupted
  (for example with a marker written at choice time), which is a
  sync-safety/product decision for Jari.
- **`sync_failed` + failure code rather than a new service state.** This reuses
  the existing re-sign-in affordance and the bad/warning styling. A dedicated
  `sync_incomplete` state would have needed new handling in every consumer.
- **Microsoft OneDrive/SharePoint not changed.** Its check is per remote and
  per library, and a library may legitimately lack listings during a dynamic
  choice. It keeps `unknown` for a remote without listings. A separate issue can
  apply the same naming once that case is understood.
- During an open folder-choice dialog for a new account, the card underneath
  now reads "Ensimmäinen synkronointi jäi kesken" instead of "unknown". That
  is accurate (no first sync yet) and temporary.

## Root cause upstream of this issue

Every push to main installs a release and restarts the daemon (AGENTS-WORKFLOW).
Any initial import longer than the gap between pushes will be cut off the same
way. The card now says so, but the person still has to start it again.

## Checks

`./scripts/test-focused.sh` for contracts, Go `./internal/daemon` and
`./internal/daemon/integrations`, and web: 616 passed. One unhandled error came
from the untouched `CodeMirrorEditor.test.tsx`. Browser specs
`integrations.spec.ts`, `lab-integration-progress.spec.ts` and
`lab-integration-inventory.spec.ts` passed. In the full clean gate
(`ci-local.sh --clean`, tree of `b873216b`), Go, contracts, web, packaging and
352/353 browser cases passed. The one failure is
`lab-browser-editor.spec.ts` 390 light, the ambiguous `main.go` locator already
filed as `singularly-habitual-kitten`, so no receipt was written.
