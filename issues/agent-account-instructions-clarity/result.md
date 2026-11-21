# Result: proposal for Jari, nothing shipped

Read `summary.md` first (Finnish, one screen). Since Jari's decision of
21.11.2026 the proposal is `research-topics.md`: the Microsoft tools as
topic areas, with `topic-areas.py` recounting the area mapping. The texts
below are the earlier proposal it supersedes for the tool surface:

- `agent-text.md`: the text the agent would read about connected accounts,
  and nothing else.
- `tool-surface.md`: the proposal for which Microsoft tools the agent is
  given, with three yes-or-no questions.
- `tool-surface-check.py`: recounts every number from the pinned server.

No product code or shipped text changed.

## Rethink of 21.11.2026

Jari found both texts too long to read. `agent-text.md` was rewritten with
the `rethink-instructions` skill and went from 479 lines to about 130: the
before/after comparisons, the rationale and the Erottelu went, and the
Microsoft section itself is shorter than the shipped one while adding a
starting point for mail and calendar. `tool-surface.md` was rewritten with
the `rethink-document` skill and went from 268 lines to about 120. Jari was
not available to agree the separation of decided from proposed, so it was
made by the agent and is stated at the top of that document. The proposal
and the `KEEP` and `DROP` lists did not change.

## How it was checked

`tool-surface-check.py` was run on 21.11.2026 against an installed
integrations runtime carrying the pinned server (0.170.1): 109 registered
names, 100 offered at Full, 55 proposed, and per level 100/95/66/48 today
against 55/54/41/32. Every number in the texts was compared with its output.
`python3 scripts/validate-project-view.py` and `git diff --check` pass.
Review level: self-review only, since the change is three issue documents and
no code, contract or authority.

Not checked: the pilot's conversation was not read, so the keyword-search
explanation is the likely mechanism, not an observed one. That Pi shows a
tool only after a search was read from the pinned Pi's `docs/mcp.md`
(1.5.2), not seen in a session.

## Decisions for later review

1. **The Google account text is left unchanged.** Alternative: the earlier
   proposal's paragraph naming the `gog` subcommand for each task. Dropped
   because `gog --help` already says it, the observed failure was not there,
   and it was one more text for Jari to proofread.
2. **"What is at stake" is left as shipped**, including "Reading costs
   nothing." Alternative: the earlier one-sentence rewording. Dropped as too
   small to ask for a proofread.
3. **`agent-text.md` no longer shows the present text beside the proposal.**
   Alternative: keep before and after. The present text is in the code, and
   the comparison was most of the length.
4. **The everyday/arranging line is presented as a proposal**, although
   `item.md` records it under Jari's direction; the wording there is the
   conductor's. Question 1 settles it.
5. **Implementation is its own issue**, since this one promises a proposal.
6. **`item.md` was not corrected** ("about 110 Outlook tools", mail rules);
   the measured numbers are in `tool-surface.md`, which names the difference.
7. **Where the line runs.** The agent works with messages, drafts, events,
   contacts and files, not with folders, calendars, sharing or sorting.
   Alternative: keep creating mail folders. One name back on the list.
8. **One tool that sends**, `send-draft-message`. Alternative: keep
   `send-mail` for a new message.
9. **No per-account switch for the full tool set, and the level does not
   change the list.** Alternatives: build the switch now; let Full show
   everything. The first is a control for a need nobody has shown, the second
   makes a level mean two things.
10. **Sign-in tools hidden through Pi, the rest through Habitat's list.**
    Habitat's list names what to offer, so an upstream addition stays out;
    the pinned server lets only Pi's setting reach the sign-in tools.
11. **Small tools kept or dropped on judgement**:
    `get-mail-attachment-content` and `list-supported-time-zones` stay;
    `download-bytes`, `get-mail-tips`, `get-mail-message-mime`,
    `copy-mail-message`, `forward-calendar-event`,
    `add-calendar-event-attachment` and the reminder tools go.
12. **Attaching a file to a draft** (the 3 MB limit, `MS365_MCP_UPLOAD_DIRS`)
    is left out as separate work: it gives the server read access to a
    directory.

## Live check

Nothing to try yet. To see today's surface on the test server with a
Microsoft account connected, ask the agent "what tools do you have for my
Outlook mail folders?" and look for `delete-mail-folder` and `logout`.

## Topic-area research of 21.11.2026

`research-topics.md` answers the research run's four questions with
measurements on the test host (Pi 1.5.2, server 0.170.1, synthetic account,
nothing signed in, every Microsoft call blocked by an experiment extension).
Evidence, scripts and raw run logs:
`/var/tmp/agent-keep/agent-account-instructions-clarity/`.
`topic-areas.py` was run against the installed integrations runtime and its
counts are the ones in the text. The name-hashing defect found on the way is
filed as `microsoft-server-name-hashes-tool-names` (unlaned).

Review level: self-review against the evidence. The change is issue
documents and a measurement script; no product code, contract, session or
authority changed.

### Decisions for later review

1. **Five areas as Jari listed them**, with mailbox administration holding
   folder, calendar and contact-folder structure, calendar sharing and
   Focused Inbox. Alternative: fold contacts into mail to save a process.
   Kept five because Jari named them and contacts is a task people ask for.
2. **Narrowing by `--enabled-tools`, not `toolExposure`.** The server then
   offers nothing outside the area and a tool can sit in two areas.
   `toolExposure` is used only for the sign-in tools the server always adds.
3. **Short names `ms-<area>`, the address in the description.**
   Alternative: keep the address in the name. Rejected: Pi hashes the tool
   names, which defeats the search.
4. **Confirmation for deletes, sending and calendar sharing (19 calls)**,
   not deletes alone. Asked as question 2 in `summary.md`.
5. **Confirmation as a Habitat Pi extension now, declarative in Pi later.**
   Alternative: Habitat MCP proxy. Rejected as a new component.
6. **Sending in one step stays available** (in the mail area, confirmed),
   since Jari asked to keep all useful tools. This reverses the earlier
   proposal's "send only through a draft".
7. **The five-process cost is put to Jari** rather than decided, because it
   multiplies with open conversations on a shared host.
