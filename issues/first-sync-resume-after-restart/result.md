# Result: an interrupted first cloud sync resumes after a daemon start

## What changed

When the daemon starts, it resumes every first pass (Dropbox, Google Drive,
OneDrive or SharePoint library) that a daemon stop interrupted. The pass runs
again with the person's original choice: the same `rclone bisync --resync
--resync-mode path2` command (cloud-preferred union, differing local files
backed up). It runs in the background, and the card shows *Synkronoidaan* with
progress until it finishes and steady sync takes over. The code is in
`internal/daemon/integrations/resume_linux.go`.

The host keeps no record of this. The evidence is rclone's own work directory,
which must hold only what a killed `--resync` leaves: the new listings
(`*.path{1,2}.lst-new`) and/or the lock of one session. Any committed (`.lst`),
previous (`.lst-old`) or error (`.lst-err`) listing, or any other file, means
the pair has sync history, and the old rule applies: no resync without the
person. Ordinary passes never run without committed listings, so only a chosen
first pass can produce this state.

A pass the person cancelled, a chosen pass that failed on its own, and a resumed
pass that failed all have their uncommitted listings removed. They then wait for
the person's next choice. Only a daemon stop leaves a pass to resume.

## The lock

These behaviours were measured with the pinned rclone 1.71.2. A SIGKILLed pass
leaves its JSON lock (`Session`, `PID`, `TimeExpires`, renewed while it runs).
A later bisync refuses an unexpired or unreadable lock and takes over an
expired one itself. A SIGTERMed pass removes its lock.

The resume removes a lock only when all of the following hold:

- it is this pair's own session;
- no visible process names the work directory in its command line;
- the PID in the lock is not a live process that could be rclone;
- the lock is unexpired or unreadable, so no other rclone could take it over
  between the check and the unlink. The bytes are compared again just before
  removal.

An expired lock is left to rclone's own takeover. A lock with a live holder is
never removed: the resume waits and looks again every 30 s, and other accounts
proceed in the meantime. A lock about to expire (within 15 s) counts as held.

## Failure and retry

If the provider is unreachable (for example after a boot before the network is
up), the resume retries with backoff from 1 to 30 min. A full home is retried
in the same way. If the resumed pass fails on its own, the card shows the new
contract failure `initial_sync_resume_failed`, "Ensimmäisen synkronoinnin
jatkaminen epäonnistui", with the sign-in hint. The daemon journal records
`integration_resume` with the provider, outcome and reason. A rejected login,
an unreachable provider and a full quota still show as those concrete states.

## Concurrency

The resumed pass runs as an ownerless relay attempt, so reconcile leaves the
account alone and no browser login starts during it, as during a chosen first
pass. Unlike a chosen pass, it runs without `c.write`. Removing the account
cancels it and waits for its rclone to exit before the login and work directory
go. Removing a sibling account of the same provider is refused while the pass
runs, because a Microsoft pass holds the provider's native lock. Shutdown
cancels the pass and leaves it resumable.

## Tests

- `resume_linux_test.go`, fake rclone: resume at start with the stale lock
  cleared and the card syncing, then healthy; the exact chosen command; a live
  lock never removed (holder named by work dir or an rclone PID), and the
  resume after the holder exits; the lock judgement table (unexpired / expired
  / about to expire / unreadable / live / foreign); unreachable retried and an
  own failure named, not repeated and no longer resumable; removal stops the
  resumed pass; a cancelled or failed chosen pass is not resumed by the next
  start; a waiting account does not block another; Microsoft resumes only the
  interrupted library and shows the outcome per service.
- `TestResumeWithNativeRclone` (set `OH_TEST_RCLONE` to the pinned 1.71.2): a
  real `--resync` on a local alias remote is SIGKILLed midway. The next
  catalog start completes it with an unexpired lock and with an expired lock.
  Every cloud file arrives locally, a local-only file reaches the remote, and
  no partial file is left.
- Mutation checks: without lock removal the native and fake resume tests time
  out; without the cleanup after a cancelled or failed chosen pass, both
  variants of the not-resumed test fail.

## Decisions for later review

- **No quota re-admission on resume.** The original choice was admitted against
  its measured size, and part of it is already on disk. A full home is
  retried, not refused.
- **A first pass killed during its size measurement is not resumed.**
  Measurement happens before rclone starts the pair, so no native trace exists
  and the card keeps "jäi kesken" with the sign-in hint. A host-side marker
  would cover this, but it would be a connection record of our own.
- **Microsoft: only libraries whose pass actually started are resumed.** A
  library chosen in the same choice but queued behind the interrupted one has
  no trace and waits for the next choice.
- **The person cannot pause a resumed pass from the card.** It belongs to no
  browser session. The stop button's notice now says that removing the account
  stops it. A pause would only last until the next restart anyway.
- **A resumed pass that fails is not retried at the next start** (only an
  unreachable provider is retried within the run). This matches the existing
  rule for a chosen pass that fails. A mid-pass network blip that later clears
  therefore needs the person's sign-in.

## Remaining limits

A process that the person starts by hand on the catalog's private work
directory, in the milliseconds between the final check and launch, is not
excluded. rclone's own lock then refuses one of the two runs.
