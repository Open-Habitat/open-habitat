# Result: the file-service card shows whether sync actually works

## Live finding (test guest, 2026-10-24 08:45–09:01 UTC)

Read from metadata, unit state, process lists and the daemon journal only. No
file contents, listings contents or tokens were read.

**Is it syncing?** Yes, both file services are syncing now.

- **OneDrive** (`maintainer@example.org`) has synced the whole time. The daemon's
  supervised loop runs one `rclone bisync` pass and then `sleep 60`. Its
  committed listings `…onedrive_.path{1,2}.lst` were rewritten at 08:44:14 and
  again at 08:45:16, so every successful pass leaves a new commit time. After a
  pass, `.lst-old` keeps the previous one.
- **Dropbox** (`maintainer@example.org`): when Jari reported the problem, nothing
  was syncing Dropbox. The first pass of 2026-10-23 had been killed by a release
  restart. There were no committed listings and no Dropbox loop in the daemon's
  cgroup, and the card said *Ensimmäinen synkronointi jäi kesken*. At 08:43:19
  Jari signed in again, which started a fresh initial `--resync`. Over 30 s at
  08:46 the local tree grew from 6.65 GB / 3,217 files to 6.90 GB / 3,392 files
  (≈8 MB/s, measured with `du`/`find` counts only). The pass finished before the
  08:52:06 release restart, because the restart killed only `node` and `sleep`
  and no rclone. Since 08:52:12 the ordinary Dropbox loop has been running, with
  listings committed at 08:58:43 and 09:00:14. The final local tree is
  7.68 GB / 4,737 files, and home quota use is 8.4 GB of 40 GB.

**Card vs. reality.** For a file service in steady state, the card showed only
*Synkronoi jatkuvasti* and *Tarkistettu klo …*. That time is the moment of the
status request (`checked_at`), and it moves with every read even if nothing has
synced for days. The daemon could not have shown more. The supervised loop sent
rclone's stderr to `/dev/null`, so the daemon never saw when a pass started,
ended or failed. A failing pass only surfaced as *Synkronointi pysähtyi,
käynnistetään uudelleen*, with no reason. The page also polled only while a
service was in the initial `syncing` state, so a steady card never changed until
it was reloaded.

## Fix

- **Last successful sync from native truth.** `last_synced_at` is the older of
  the mtimes of the two committed bisync listings (`*.path1.lst`,
  `*.path2.lst`) in the service's working directory. For several SharePoint
  libraries it is the oldest. The value is read with `fstatat` on every list
  request and is not stored anywhere. I checked this against real rclone 1.71.2
  (the binary pinned on the guest, run locally on two scratch directories). A
  successful pass rewrites both listings. A failed pass (exit 1, the
  `too many deletes` safety abort) leaves them untouched. So this time does not
  move unless files actually synced.
- **A pass that is running now, with live counters.** All three rclone providers
  (Dropbox, Google Drive, Microsoft) now build their loop with one `syncLoop`
  (`passes_linux.go`). Before and after each pass it writes its own marker line
  to stderr: `{"open_habitat_pass":N}` and `{"open_habitat_pass":N,"exit":rc}`.
  rclone runs with `--use-json-log --stats 1s`. The supervisor feeds that stderr
  to a bounded line reader (`passObserver`). It keeps only the current pass's
  counters and a fixed failure code, never any text. An ordinary pass shows as
  state `ok` with `progress`, and the card says *Synkronoidaan nyt* with the
  phase, elapsed time and file count. The stop button stays reserved for the
  initial sync.
- **A concrete failure.** A failed pass is classified from rclone's error-level
  messages into `delete_limit`, `needs_resync`, `remote_unreachable` or
  `pass_failed`. Exit code 2 means `needs_resync`. A pass that dies without its
  end marker counts as `pass_failed`, unless the daemon stopped it. The service
  becomes `sync_restarting` with that `failure`. The reason survives the
  supervisor's restarts and is cleared only by the next successful pass, so it
  does not flicker between retries. The two native safeguards also show what
  the person should do.
- **The page stays live.** While any account has a synced folder, the settings
  page re-reads the catalog every 15 s (single flight, paused while the tab is
  hidden), as it already did during an initial sync. For a file service the row
  shows *Synkronoitu klo …* (or *d.m. klo …* for an earlier day), or *Ei vielä
  synkronoitu*, in place of the check time. Mail, calendar and contacts rows
  keep *Tarkistettu*.
- **Contract** (`integrations.schema.json`): an optional `last_synced_at` field;
  four new `failure` values for `sync_restarting`; `progress` documented for an
  ordinary pass. All of these are additive optional v1 fields.

## Tests

- `TestSteadySyncPassesReachTheCard` runs the real supervisor and loop with a
  fake rclone through the browser API. It checks four things in turn: running
  pass counters on an `ok` service; `last_synced_at` equal to the older listing
  (not the request time); `delete_limit` that stays the same across ten polls
  while the supervisor restarts the loop; and recovery to `ok`.
- `TestPassOutputClassifiesOnlyItsOwnPass` covers the parser. A safeguard wins
  over a later network error. An error outside a pass is ignored. Oversized
  lines are dropped and unknown pass indexes ignored. A killed pass differs from
  a stopped one, and a retry does not hide the failure.
- A one-off run of `syncLoop` against real rclone 1.71.2 (not committed, since
  it needs that binary) classified a real `too many deletes` abort as
  `delete_limit`.
- Two component tests. One checks that a file service shows its last successful
  pass in a `<time dateTime>` (not `checked_at`), and that a running pass shows
  counters but no stop button. The other checks that a `delete_limit` row is a
  warning, keeps its last success visible and offers no re-sign-in.
- Story *Production/Integraatiot › Ordinary Passes* shows a running pass, a
  delete safeguard and a network retry. I reviewed screenshots at 1280 and
  390 px.
- Checks run: focused Go (`internal/daemon/integrations`), contracts,
  `--area web`, browser specs `integrations`, `lab-integration-progress`,
  `lab-integration-inventory` and `lab-integration-trash`, and one
  whole-browser-suite run.

## Decisions for later review

- **Listing mtimes are the "last synced" truth, not a daemon record.** It
  survives daemon restarts and needs no new store. The alternative was a
  timestamp the daemon keeps per pass, which is lost on restart and is a second
  source of truth. One limit: a manual native operation that rewrites the
  listings without syncing (for example someone running `--resync` by hand)
  would also move the time.
- **A marker line from our own shell loop rather than one Go-run pass at a
  time.** The supervisor already treats the whole loop as one child with
  backoff, and Microsoft's libraries must stay serial on one config. Markers
  give exact pass boundaries and per-library attribution without changing that
  shape. rclone's JSON log escapes every message, so it cannot produce a
  top-level `open_habitat_pass` line. Even a forged marker could only change
  this person's own card.
- **A steady pass is `ok` + `progress`, not `syncing`.** `syncing` means the
  initial pass (it gets the stop button and the initial-sync wording). A new
  state was not needed.
- **Failure codes come from substrings of rclone messages.** rclone has no
  stable error codes for these, so a future wording change would degrade the
  code to `pass_failed`, never to a wrong reason.
- **Polling while a synced folder exists.** Each read runs every account's
  status check (`rclone about` and similar, about 1.3 s on the guest). That cost
  already applied during initial syncs. The page reads only while visible.
- **Login failures during a pass are not a separate code.** The status check
  already reports `login_expired` from `rclone about`, and that state takes
  precedence over a pass failure.

## Coordination

The `first-sync-resume-after-restart` issue owns resuming an interrupted initial
pass. This change does not touch `ChooseFolders`, initial-pass state or lock
handling. The two overlap only in that a resumed initial pass, once committed,
will show its `last_synced_at` here.
