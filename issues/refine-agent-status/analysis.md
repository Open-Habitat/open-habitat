# Agent-state meanings for the control-state design round

Prepared from Jari's 5 October navigation review, the returned [`align-navigation-design` handoff](../align-navigation-design/design-package/HANDOFF.md), `contracts/v1/snapshot.schema.json`, `web/src/app/conversations.ts`, `web/src/app/WorkspaceRailView.tsx`, `internal/daemon/conversation_linux.go`, and [conversation ownership](../../docs/architecture/conversations.md). These are **user-facing meanings and examples**, not a new wire enum or a component prop API.

## The questions are separate

- **Is the agent open, working or closed?** A process observation by itself is not a turn state. `process: daemon_managed_live` and a fresh managed status can support open/working; `activity: running` or an accepted turn with live progress supports working, whereas an idle process need not have produced a response. `confirmed_exited` says the process ended, not whether it was deliberately closed or crashed. `unknown`, `not_observed` and `stale` do not prove closure.
- **Does the person need to return?** An open agent awaiting a reply is **odottaa**. A new response or Pi question attracts attention until the person visits the conversation. Visiting clears *attention*, not the agent's waiting state. A previously seen error likewise remains visible on the row but stops occupying the attention section. This is separate from current-route highlighting.
- **Can the browser write?** `control: read_only` in the snapshot (including terminal sessions) is a capability, not proof that the agent is closed or waiting. Keep a visible *vain luku* example for this round, even though planned changes could later eliminate some read-only situations.
- **Did an operation fail?** An observed send error is shown as **Lähetysvirhe**, with no claim that the message definitely was not delivered. Connection loss blocks a new send; reconnection checks the earlier command automatically, never resending it automatically. A provider error requires actual reported failure, not merely a live process or unknown status. Unreadable history has direct `history: missing / corrupt / unavailable` evidence; avoid claiming a Pi crash from loss of contact alone.

## Representative states and evidence

| Example | Meaning shown to the person | Basis and limits | Action |
| --- | --- | --- | --- |
| Työskentelee | An open agent is doing work | Fresh live status/progress or reliable running activity, not process presence alone | Open to follow; interrupt if browser-controlled |
| Odottaa, new | Open agent has answered or asked a question and awaits the person; not yet visited | Verified settled turn linked to a native history entry or a current `pending_question`, plus known open control; a per-person read marker is also needed | Open conversation; answer or close the agent |
| Odottaa, seen | Same open waiting agent; attention cleared on visit | Same native facts as above, plus visited marker | Reply later or close |
| Valmis | Agent has been closed; prior conversation remains available | Needs affirmative closure/ended fact, not just `confirmed_exited` or stale observation. A closed conversation may be resumable only if capability allows it | Read history; continue explicitly only when verified eligible |
| Vain luku | Browser can read but not write | Snapshot `control: read_only` and readable history; process may be live in terminal or unknown | Read; do not show a send action |
| Lähetysvirhe | A send encountered an error | Rejected receipt or failed/lost acknowledgement, retaining the underlying outcome distinction for safe reconciliation | Wait for automatic check after reconnection; never auto-resend |
| Ei luettavissa | History cannot be shown | Snapshot `history: missing / corrupt / unavailable`, keeping diagnostic distinctions internal | Refresh or inspect the native source if appropriate |
| Tila ei tiedossa | Agent's process/activity cannot be established | Unknown, not-observed or stale host information | Keep last known content and refresh; never label as crashed or closed |

The draft's old unread-**valmis** → seen-**odottaa** transition is wrong. A long wait is not a new state and needs no 10-minute threshold. Pi's explicit question is a visible kind of waiting that also needs its own response dialog; it is not a variant of *valmis*.

## Gaps to carry into design and implementation

1. The browser currently has selected-conversation read position and foreground/background indicators, but not a shared per-conversation *visited native entry / question* marker that establishes whether an unvisited waiting turn or error needs attention across the home, rail and agent list. The presentation needs an input derived from actual native keys/events and browser reading state; the design must show both new and seen cases without pretending the host already supplies that bit.
2. The managed stop handler returns `termination_unknown` and moves its session to `uncertain`; the snapshot's `confirmed_exited` alone says nothing about intent. Do **not** map every ended process to *valmis*, nor to a crash. An affirmative closed state, and a separate confirmed failure if desired, need a source-grounded implementation choice before those labels appear on real rows. Until then use a neutral ended/unknown indication and keep history readable.
3. Terminal histories have read-only control and may have unknown process observation. Without a confirmed live turn or current question the host cannot promise *odottaa* for those sessions merely because the last native entry was by the assistant.
4. Connection loss and a send error are operation/transport conditions, not a replacement for the agent's activity state. The dedicated control-state round should design how they coexist on the same row, not multiply mutually exclusive agent states.

Design input: [the reconciled navigation draft](../../design-system/drafts/Navigaatio%20ja%20asetukset.dc.html) demonstrates working, waiting-new, waiting-seen, closed, read-only, unknown and error examples on desktop and phone in both themes. Its dashed read-only marker and other forms are provisional until the shared control-state round agrees them. Use the shared `agentPresentation` mapping from host facts when implementation begins; do not duplicate host inference inside visual components.
