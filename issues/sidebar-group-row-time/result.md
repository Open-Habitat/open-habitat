# Result: compact Ryhmät rows with the state ball and time (Aika)

The rail's Sinun vuorosi and Käynnissä rows are now one line: the state
ball, the title and the time since the conversation last changed (*nyt*,
*4 min*, *2 t*, *3 pv*). The workspace, state and what the row waits for are
in the row's tooltip and its screen-reader description. Käynnissä is grouped
per workspace (round 1's Ryhmät) under a sticky monospace heading with its
count. A done row unchanged for over an hour folds behind *N hiljaista* at
the end of its group, and a workspace whose rows are all quiet sinks under
*Hiljaiset · yli tunnin* as one toggle. The open conversation and a failed
row never fold. The rows are 24 px on the desktop and 40 px on the phone.

The host publishes the last change as the snapshot agent's `changed_at`.
It is the Pi session file's modification time, which discovery already
reads with `Lstat`. Pi appends every entry to that file, and every write
already invalidates the snapshot, so the time follows the host live. The
rail's clock moves once a minute.

Balls: working is the accent and pulses with a halo (this includes waiting
on background work and a parent whose worker works). Your turn is the new
`--ah-turn` amber token, done is `--ah-ok` and failed is `--ah-err`.
Unknown, for example during a lost connection, is an open grey ring.

Evidence: `web/tests/rail-groups.spec.ts` writes
`test-results/evidence/rail-groups-desktop-fold.png` and `rail-groups-phone.png`.

## Decisions for later review

- **The last change is the session file's mtime.** Alternative: the
  timestamp of the last entry on the branch, which the result of
  `research-workmux-sidebar` named. The mtime is already in hand from the
  header read and costs nothing per snapshot. The last entry's timestamp
  would mean reading every session file in full on the first snapshot. The
  mtime also moves on a rename (`session_info`) or a model change, which
  are changes to the conversation too. A copy that does not keep mtimes
  would make a conversation look fresh. Discovery is the only reader that
  sets it, so a conversation with no session file yet shows no time.
- **Failed covers only a Pi crash in this change.** Failed is shown when the
  snapshot's `rest.cause` is `crash` and Pi has not been woken again. Such a
  conversation now stays in Käynnissä instead of dropping out of the rail.
  The other two sources the prototype named, a Taskfleet worker run that
  failed and a turn that ended in an API error, are not per-agent facts in
  the snapshot today. Adding them is `rail-failed-worker-and-error-turn`.
- **Failed is a diamond, not a round ball.** Done and failed differed only
  by green and red, which many eyes cannot tell apart, and a review caught
  it. Alternative: a visible word such as *kaatui* at the end of the row,
  which is Tieto's direction rather than Aika's.
- **Hours are *t*, not *h*.** The prototype wrote *2 h*. The product
  already says *2 t sitten* in the recap and Git status. Under a minute is
  *nyt*, because the clock moves only once a minute.
- **The time is in `--ah-muted`, not `--ah-faint`.** Faint text on the rail
  is 4.43:1 at 11 px, below WCAG AA.
- **Catalog order stays inside each group.** The walk order of Sinun
  vuorosi, most recent change first, belongs to the next-waiting row
  (`next-waiting-row-experimental`). A rail row that jumps on every turn is
  harder to hit.
- **Groups are alphabetical by workspace name**, like the workspace list
  below them.
- **The worktree agent's glyph and the parent's working-worker mark stay on
  the row.** The prototype dropped a Taskfleet worker's branch glyph, but
  production never showed one. The worktree glyph (ADR 0025's merged mark)
  and the branch mark of a parent with a working worker are existing
  features with their own tests.
- **The conversation header's state is unchanged.** The prototype also used
  the ball in the top bar. That is a separate surface, and the issue named
  only the rail rows.
- **Folds are not kept across a reload**, as in the prototype. They are view
  state in the tab.
