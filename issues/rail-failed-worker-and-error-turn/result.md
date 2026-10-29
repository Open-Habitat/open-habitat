# Result: failed ball for an error turn and a failed worker

The snapshot agent has a new fact, `failure`, that the daemon derives from
native sources, and the rail shows it as the red failed diamond:

- **`turn_error`**: the last message on the conversation's active Pi branch is
  a reply that ended in an error (`stopReason: "error"`). The branch scan that
  already serves the process tray and the catch-up
  (`internal/daemon/process_interrupted_linux.go`) now also records this, and
  it is cached per file stamp. A retry's answer or the person's next prompt
  ends it, because the last message is then no longer the failed reply.
- **`worker_failed`**: one of the conversation's own Taskfleet runs failed
  after the conversation last changed, so no one has written to the
  conversation since the failure.

The rail (`web/src/app/railNow.ts`) shows either one as failed unless the
conversation is working right now. The row stays in Käynnissä when its Pi is
not live, as a crash row already did. The tooltip says *Vuoro päättyi
virheeseen* or *Worker epäonnistui*. A failed row does not count as live work
in the workspace hint. The browser spec `rail-groups.spec.ts` covers the error
turn end to end with the fake Pi (prompt *virhevuoro*): the row turns red, and
it is done again after the person writes.

## Decisions for later review

- **A failed worker marks its parent's row, not a worker row.** The issue
  assumed that a worker's own conversation is a rail row that keeps the done
  or working ball. In production it never is. A Taskfleet Pi worker writes
  its session under Taskfleet's state root, not under `~/.pi/agent/sessions`,
  and its worktree is excluded from the workspace places, so the rail never
  lists it. Only the prototype had worker rows. The row that can show the
  failure is the parent conversation that created the run
  (`belongsSpinoff`). That row already gets the working ball while its worker
  works. Alternative: make worker conversations rail rows. That is a larger
  change to discovery and to the rail's membership.
- **"Newer than the conversation's last change" bounds the worker failure.**
  The failure counts while the run's end time is later than the parent's
  session file mtime. A parent that waits for the run is woken by its end,
  writes, and so never turns red. The red ball is for the parent that did not
  hear about the failure. Without the bound, every old failed run would turn
  its conversation red forever. Alternative: read the parent's branch for a
  catch-up or wait result naming the run. This is more precise but needs a
  branch scan of every parent with a failed run. A known gap: a parent that
  keeps working on its own turn after the worker failed clears the mark
  without having noticed the failure.
- **The end time comes from the run's `manifest.json` `updated_at`, read
  directly.** `run list` has no end time. `run show` does, but it costs about
  0.1 s per run on every snapshot. The file's mtime is no substitute: on
  Birch a failed run's manifest was rewritten two hours after it failed. The
  manifest is read like the brief's `prompt.md` (own UID, beneath home, no
  symlinks, at most 1 MiB), and only for failed runs of listed
  conversations.
- **An error turn is read only for a Pi that runs now** (terminal-observed or
  daemon-managed live). The branch scan reads the whole file. Reading it for
  every closed conversation would cost the first snapshot a full parse of
  every history, and a closed conversation is not in the rail anyway. A
  browser conversation that idles out of its Pi drops out of Käynnissä as
  before.
- **A person's stop is not an error.** When the person stops a turn while a
  tool runs, the pinned Pi saves the reply as `stopReason: "error"` with the
  AbortError text. The existing `piStopReason` classifies that as an abort,
  and the rail does not turn red for it.
- **Failed loses to working, and wins over your turn in the tooltip.** A
  conversation that is working again (a Pi retry, or the person's new
  message) is not failed. An error turn whose reply is unread stays in Sinun
  vuorosi. Its ball is red and its tooltip names the failure instead of
  *Uusi vastaus*, because the ball already puts failed first.
- **`turn_error` wins when both facts hold.** The conversation's own turn
  failing is the more direct thing to look at.
- **Sessions over 32 MiB never get `turn_error`.** The branch scan reads at
  most `maxLegacyHistoryFile`, and the process tray and the catch-up have the
  same limit. The review raised this, and it was accepted as a limitation.
  Such a row shows its ordinary state, never a false failure. On Birch no
  session file is over 8 MiB.

Review: `/llm-review` with gpt-6-astra as the finder and no verifier, then
`/assess-findings`. It produced one finding, the 32 MiB limit above, which
was dropped.
