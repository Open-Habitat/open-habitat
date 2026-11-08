---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Starting a helper is awkward for the agent, and helpers leak across conversations (archived leftovers, name collisions)

## Description

Jari 8.11.2026, test server, conversation
`pi:6199d39e-dacc-4b9c-a90b-b7e631eacb75` (screenshot
`evidence/jari-helper-start-2026-11-08.avif`). He asked the agent "Tee meille
testiavustaja" with Avustajat enabled.

1. **Starting a helper is awkward for the agent.** It took about ten tool
   calls: it grepped the repository to learn what "avustaja" means, read
   `taskfleet run create --help`, met a name already taken, inspected that
   run, renamed its own to `testaaja`, and ended unsure whether `run wait`
   returns at a round report or only when the run ends. Habitat's shipped
   agent guidance (`open-habitat skill print agent`, the Open Habitat system
   prompt) should make "make a helper" one obvious recipe: what a helper is,
   how to name it, how to wait for a round, how to land and relay it.
2. **A helper from an archived conversation dangles.** A helper created by an
   earlier, since archived conversation was still visible to and in the way
   of the new conversation. The agreed behaviour (`web/src/text/archiveNotice.ts`)
   is that helpers go with an archived conversation and return with it; they
   should not show up in, or block, another conversation.
3. **Name collision between two conversations' helpers.** Taskfleet resident
   names are repository-scoped, so two conversations in the same workspace
   collide on a natural name like `testiavustaja`. Jari: that should not
   happen; a conversation's helpers are its own.

## Acceptance Criteria

- [ ] An agent asked to make a helper does it from the shipped guidance in one or two calls, including how to wait for a round.
- [ ] A conversation sees and manages only its own helpers; an archived conversation's helpers neither show elsewhere nor block a name.
- [ ] Two conversations in one workspace can each have a helper with the same name, or the guidance and host make the collision impossible to hit; decision recorded.
