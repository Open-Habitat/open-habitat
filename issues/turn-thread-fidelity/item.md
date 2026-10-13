---
created: 2026-10-13
updated: 2026-10-13
type: bug
reporter: jari
status: open
priority: normal
related: ['@bash-card-fidelity', '@agent-turn-layout']
preparation: ready
lane: web
lane_seq: 10
collision: [web/]
---

# Agent turn thread lacks block marks and breaks after the first group

Jari reviewed live conversations in pilot.25 on 2026-10-13 against the agreed
agent turn (`design-system/drafts/Agentin vuoro.proto.html`; rules in
`design-system/prototypes/lib/language.css` and `turn.js`/`live.js`):

- The thread has no marks for its blocks. In the draft every block on the
  thread has its own node: a dot for thinking, a small square for a tool use,
  an accent "active" node on the block in progress and done nodes afterwards,
  with the head node and the strip node at the ends. Production
  (`web/src/components/AgentTurn.tsx`) draws only the head node
  (`.ah-turn-node`).
- The thread line stops part-way. In one conversation it ended after the
  thinking row "Planning issuectl DAG listing", and the failed `bash` uses that
  followed had no line. The cause is in `components.css`: the line is
  `.ah-turn-work::before` placed in `grid-row: 1` of the work subgrid, so it
  spans only the first child of `.ah-turn-work`; when the work holds several
  consecutive groups (as with tool uses after a thinking block from another
  native entry), later rows have no line. The line should run the whole work
  and reply column, whatever the number of rows.

Fix together with @bash-card-fidelity (same files: `AgentTurn.tsx`,
`components.css`, `app/HistoryView.tsx`, `app/BrowserConversation.tsx`), after
@conversation-actions-layout lands. Verify in the lab with a turn of several
groups, failed tools and a live turn, against the draft at desktop and phone
width, light and dark.
