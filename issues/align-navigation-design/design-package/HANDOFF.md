# Navigation and settings: returned design assessment (in progress)

Response: `Navigaatio ja asetukset -vedos.zip` received 2026-10-05, based on the package at `7364709396830ebf8fdb9a4b5fa9fc29c3c402e9`. Source request: [REQUEST.md](REQUEST.md). This is a review of the proposal, not implementation acceptance. The returned archive is on Jari's seat; the draft has not yet replaced the maintained `design-system/drafts/` set.

## Keep as the composition to review

- One expanded rail and phone drawer sharing navigation content, with a reduced collapsed rail. Separate current location from agent status and attention; make workspace name and disclosure separate targets.
- A workspace page with name, path, start-conversation action and conversation lists, filling the gap named in the request.
- Return view ordered around attention, ongoing work and recently opened conversations; settings with account, native connections, appearance and browser session sections; one consistent account presentation and logout confirmation.
- Initial history loading and quiet return to saved draft/reading position. These follow the requested behavior, subject to visual comparison and actual host facts.

## Corrections agreed with Jari

- A send whose acknowledgement was lost appears as a concise **send error**, not a prominent uncertainty state. On lost server connectivity, block new sends; on reconnection, check the prior send automatically before permitting another. Do not tell the person to inspect it manually and do not automatically resend. The host still distinguishes confirmed rejection from unconfirmed receipt; the draft's `ei lähetetty` label must not assert a known non-delivery without evidence. See the decisions in this issue and the agreed experience in `design-system/design.md` and `docs/ui.md`. The current browser does not yet fully implement this connectivity gate and copy.
- `odottaa` means an open agent waiting for the person's reply. It demands attention until the person visits the conversation; visiting clears attention, not the waiting state. `valmis` means a closed agent, not an unread completed turn. A person who does not wish to reply can close the agent. The returned draft's unread `valmis` → seen `odottaa` transition and its `valmis` attention counter therefore cannot be carried forward. See @refine-agent-status.
- On the return view, `Odottaa sinua` should be driven by not-yet-visited waiting conversations, not by closed agents. A closed agent can remain among recently opened conversations.

## Not yet settled or verified

- The HTML draft's own notes and `VASTAUS.md` disagree about the proposed `NavRow` and `StatusMark` variants (the HTML still names `attention / readOnly / uncertain`, while the response text proposes `ready / waiting / error`). Resolve against the actual state mapping rather than copying either list literally.
- The response removes read-only and unknown process state from its agent-state set. Read-only browser access is a separate capability and must remain visible. A lost process/contact does not by itself prove a crash or closure. Map each proposed error to evidence the host actually has before choosing labels.
- The 18 × 10 control-state table is input to @design-control-states, not approval of 180 universal state combinations. Check applicable states against the actual components and avoid duplicating the later dedicated round.
- Missing examples remain: actual profile image, pending OpenAI sign-in, failed logout, and reproducible drawer/collapsed/empty-filter captures. Compare the returned draft against the previous drafts using matching synthetic-state screenshots before replacing them; HTML diff alone is not visual evidence. No such comparison has been recorded here yet.
- Long-name truncation, background list reordering during focus, confirmed Git data for the workspace page and the detailed presentation of a native Pi question remain to be settled or verified.

No new feature, token or component API is accepted solely because the response proposes it. Implementation issues and the maintained design are updated after this handoff review is resolved with Jari.
