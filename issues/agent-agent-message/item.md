---
created: 2026-11-24
updated: 2026-11-25
type: feature
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: pending
---

# Agent-to-agent message between the person's conversations (design and prototype)

## Question (Jari 24.11.2026)

"I have two agents side by side and I would say: send that agent this message." Jari
assumed there is no such feature and asked to think through how it would be done, with a
prototype.

## What already exists (conductor, 24.11.)

The agent CLI already lets an agent write into the person's other conversations:
`open-habitat agent conversation list` (pick by `agent_id`) and
`open-habitat agent message create --conversation pi:UUID --delivery send|steer|follow-up`,
plus `receipt show`, `queue show|delete` (`internal/cli/agent/SKILL.md`, "The person's
other conversations"). So the plumbing exists; what is not designed is the experience.

## To think through

- Discovery: does the agent know it can do this, and can the person name the target
  conversation naturally ("the one about the customer meeting", "the other one on the right")?
- Attribution: in the receiving conversation, a message from another agent must not look
  like the person wrote it. How is it shown (sender conversation, link back), and how does
  the receiving agent know who sent it and whether it may act on it?
- Replies: does the answer come back to the sender (a wait, a reply message), or does the
  person read it there?
- Authority and loops: the person's instruction is the only source of authority; agents
  messaging each other without the person, ping-pong loops, steer vs. follow-up, a busy
  or stopped target, multiplayer conversations owned by someone else.
- Relation to workers (`worker-asks-parent`, Taskfleet `node ask`/`run answer`) and helpers.

## Decisions

### 2026-11-24T07:28:23Z · @jari

Jari 24.11.2026 on round 1:
- Sender side (left): C Kierto is closest, but think further about how it looks when the message arrives, is answered, and so on. Perhaps a quote of the earlier message in the reply, and the next reply quoting that. Open: what if the other agent sends several messages, which one is "the answer"?
- Model: there need not be a request/answer protocol. Agents exchange equal messages, like two people talking: A sends a message, does its thing, and may later get a message back from B. B's message back is a message like any other, not "the reply to X". A quote mechanism may still show what it refers to.
- Receiver side (right): A Kirje's model is right: the incoming message looks much like the person's own message, but the sender shown is someone else, with iconography saying an agent sent it, and a reference/link to the sending conversation.
- Riff on these in round 2. (Timestamps on messages are a separate prototype: `times-conversations-prototype`.)
Next action (approved): prototype round 2 to this model.

### 2026-11-24T19:56:56Z · @jari

Jari 24.11.2026 on round 2: A Kirjeet. Hop limit: Jari does not see why agents should not talk more; the conductor explains the runaway-loop concern and proposes a guard instead of a hop limit (decision pending). Prototype next: riffs on the outgoing message bubble (always shown vs. only when the agent does not say it sent one, and its shape). Next action (approved): prototype round 3.

### 2026-11-25T18:13:12Z · @jari

Jari 25.11.2026 on round 3: A Peili (the outgoing message is always its own bubble, the mirror of the incoming letter). No runaway guard and no hop limit: agents may message each other freely. Prototype next: the texts and details in the message blocks, which carried unnecessary words and details (e.g. "Viittaa viestiin"). Next action (approved): prototype round 4 on the copy, then implementation once Jari accepts it.
