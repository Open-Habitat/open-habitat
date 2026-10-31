# Result: finished conversation stays under Käynnissä

## Cause

The daemon had it right; the rail's rule put the conversation there.

Live state on Birch (pilot.16, 08:21Z, own user, `open-habitat agent …`;
files in `evidence/`):

- `conversation show`: `state: idle`, `run_active: false`,
  `turn_settled.state: settled` at 08:08:03Z, no queue, no pending question,
  no recap failure.
- `conversation list`: `state: idle`.
- `process list`: no background process.
- The conversation's Pi (pid 1454394, child of the daemon, cwd
  `~/src/fleetrepo`) was still running, idle at its prompt, as the daemon
  keeps it after a turn until its rest.

The browser snapshot (`/api/v1/snapshot`) is served only to the gateway
peer and could not be read as the user. Its agent row follows from the code:
`process: daemon_managed_live` (Pi is alive), `run_active: false`, no
`waiting_on`, no spinoffs. `agentPresentation` turns that into activity
`waiting` ("Odottaa viestiä"), and `railNow` counted every live Pi that was
not closed as Käynnissä. So any conversation whose Pi stays open after its
turn sat in Käynnissä with a done ball until Pi's rest stopped it, whether or
not the reply had been read. The recap, the file offer and the notice did not
matter: the recap runs as an extension command that does not start a run, and
offers and notices do not touch the run state.

This was the original Nyt design (`sidebar-now-aakkoset`: Käynnissä listed
"working, waiting for a message, waiting on a process or worker", and
`sidebar-group-row-time` folded such done rows after an hour of quiet). Jari's
report reverses that.

## Change

`web/src/app/railNow.ts`: a conversation whose live Pi only waits for a
message is no longer live work. Käynnissä keeps working conversations,
background waits (process or Taskfleet worker), a busy or idle worker of its
own, failed turns and workers, crashed Pi and a live Pi whose turn state is
unknown (terminal). A row present because of its worker now says *Worker
työskentelee* / *Worker odottaa sinua* instead of *Odottaa viestiä*; the
`rail.waiting` text became unreachable and was removed from both catalogs.
The workspace hint no longer counts waiting conversations.
`docs/product.md` says the same.

Tests: `railNow.test.ts` covers the ended turn, its unread reply, its return
when working and its worker. `web/tests/rail-running-after-done.spec.ts`
reproduces the report in a real browser host (fails without the fix at the
first idle conversation): a slow turn is in Käynnissä while working, leaves
it when it ends, stays out after a file offer with its notice, a snapshot
refresh and another conversation, and returns while a second turn works.
Specs that used a finished conversation as a rail row (`rail-now`,
`rail-unread`, `rail-groups`, `rail-archive`, `spinoffs`,
`next-waiting-row`, the duplicate-send case in `browser-conversation`,
`lab-conversation-name`, `lab-workspace-icons`) now use a working, failed or
worker-waiting row, or the header, and assert that the finished one is gone.

## Decisions for later review

- **The open conversation leaves Käynnissä too.** Alternatives: keep the
  conversation the person is looking at in the rail while selected. Chosen
  because the report asks for every finished conversation to leave, and the
  rail is not the way back to the open one.
- **A new conversation nobody has written to is not in Käynnissä.**
  Alternative: show it until its first turn. Chosen because nothing works in
  it; it is on its workspace page.
- **A worker waiting at its own prompt still keeps its parent in Käynnissä**
  (done ball, folds after an hour of quiet). Alternative: treat it as
  finished too. Kept because the person is expected to act on that worker;
  the quiet fold now applies only to such rows. Its workspace hint still
  says "odottaa viestiä", which was already so.
- **A terminal Pi whose turn state is unknown stays.** The host cannot tell
  it is finished; unchanged.
- **Archiving a finished conversation from the rail** is no longer possible
  because it is not there; the header and the workspace page archive it.

## Review

Web-only change in the browser's presentation of existing host facts; no
daemon, contract, session-state or authority change. Focused self-review.
