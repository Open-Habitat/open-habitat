# Result

## Cause (Birch, metadata only)

Conversation `pi:b3a8fb8f-…` was created at 08:46:02 (daemon `POST /api/v1/conversations`);
no message was sent to it, and the daemon logged `conversation_idle_stop` for it at
08:57:42. Pi writes its session file only after the first message, so there is no file
for that ID under `~/.pi/agent/sessions/`. After the idle stop the daemon kept only an
in-memory handle (state `stopped`, child reaped). The snapshot listed it with
`history: "missing"` and `archive: "active"`, so:

- the conversation's close was greyed, because `closeEmpty` required a live, idle child
  and the web offered close only in state `idle`;
- the card's archive went to the daemon and was refused: the gateway logged
  `POST /api/v1/workspaces` 409 at 10:53:20 and 10:54:40, and `archiveInput` returns 409
  `control_uncertain` when no native history exists;
- the card read the recap, which also has no native source, hence *Katsausta ei voitu lukea*.

The same archive refusal hit a fresh empty conversation even before the idle stop.

## Change

- `closeEmpty` also closes a conversation created in this daemon incarnation whose child
  has been reaped (`stopped` or `start_failed`, nothing held, no accepted message, no
  running `!` command). It fences sends with the `stopping` state under the proof permit,
  takes a fresh Pi ownership lock (refuses with `writer_conflict` if any Pi holds it),
  checks the browser origin in the lock file, and accepts only absent or settings-only
  native history, as for a live child.
- Web: close is offered for a `stopped` empty conversation without held messages; the
  home card's archive closes a conversation whose history is `missing`; such a card
  shows *Ei vielä viestejä* and reads no recap.
- Fixture `/fixture/idle-stop` runs the production idle stop in the browser host.

## Evidence

- `go test ./internal/daemon` (incl. `TestCloseEmptyAfterIdleStop`: absent, empty,
  cancelled send close; content, other lock holder, not created, held refuse).
- Browser spec "empty conversation closes after Pi's idle stop, from the page and the
  home card" passes; against the pre-change web and daemon it fails at the greyed close.
- Web unit/static checks; whole browser and lab suites (see commit).
- Independent review (Fable finder, Astra verifier): one finding fixed (cancelled held
  send left the handle unclosable), one dropped as rare (a refused home-card close leaves
  a stale close notice for the workspace page).

## Decisions for later review

- Archive of a conversation with no native history closes it instead of archiving:
  there is nothing to keep or restore. Alternative was an archive annotation on a
  history-less ID, which would be orphaned on daemon restart (the handle is gone then).
- An empty conversation is not closed automatically at idle stop: a person may come back
  and send to it (the daemon relaunches it fresh). Destruction stays explicit.
- After a daemon restart such a conversation disappears from the lists by itself, as
  before; no change.
- The card text for `history: "missing"` is *Ei vielä viestejä*, also for the rare case
  where a native file vanished under a live handle.
