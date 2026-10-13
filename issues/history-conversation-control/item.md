---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: fixed
priority: normal
lane: web
lane_seq: 18
collision: [web/, internal/daemon/]
closed: 2026-10-13
closed_by: claude
---

# Detect the native Pi writer so old conversations can continue, archive and show their state

Jari, 2026-10-13 on the test server, an old conversation ("Quick Ping",
workspace issuectl) after the daemon had been updated:

- The top bar says "Prosessin tila ei tiedossa" although no Pi process holds
  the conversation; Jari expects the host to detect that.
- The page is "Vain luku · Tätä keskustelua ei voi ohjata selaimesta" with
  only "Uusi keskustelu"; Jari wants to continue the same conversation.
- Archive was refused: the row left the sidebar and came back almost at
  once, and the conversation showed "Arkiston tila epävarma · Arkistointia
  ei tehty: keskustelun tila muuttui tai kirjoittaja on aktiivinen. Päivitä
  tiedot." Retitle and archive are disabled in the info popover.

Another agent traced the continue path (Jari's screenshot, 13.10.): the
daemon forgets in-memory handles of running conversations on restart, the
browser takes a missing handle to mean the conversation belongs to
`HistoryView` ("Vain luku"), while the daemon's `POST …/continue` can already
start a new Pi process on the same native conversation once it verifies
origin, workspace, history and that no other writer is active. Its proposal:
when old history opens, the browser asks the daemon for continue eligibility
even without a handle, shows "Jatka keskustelua" only after a positive check,
uses the existing continue interface and switches to the controlled view; no
automatic resend; conversations begun in a terminal stay read-only.

## Root and goal

All three symptoms come from the daemon not knowing whether a native Pi
writer holds the conversation once its own handle is gone. Detect it from the
native source: the daemon runs as the person's Unix user and can see that
user's own Pi processes and which session file each has open. With that
fact:

- the state chip says "Ei käynnissä" (or the live state) instead of unknown,
  and stays "unknown" only when detection genuinely cannot decide;
- a browser-begun conversation with no active writer offers "Jatka
  keskustelua" through the existing continue path (proposal above);
- archive and retitle work for it, and are refused only when a writer is
  really active, with that reason.

Detection must stay inside the person's own UID (no other users' processes,
no root helper) and must fail closed for writes: if it cannot tell, it does
not allow a second writer. Terminal-begun conversations stay read-only for
control but may still be archived and retitled when no writer is active.

## Done when

- Tests prove: detected no-writer → continue offered and works, archive and
  retitle succeed; detected writer → refused with the honest reason;
  undecidable → unknown and fail-closed; a process of another user is never
  read.
- Lab evidence of the old-conversation view before/after in this folder,
  `result.md` records the detection method and its limits.
