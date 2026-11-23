# alice-12-before-i-go

Alice · 17:28 · Before I go.

## What the reader sees

Three words from Alice, marked as her own skill. The reply holds two diffs:
three new lines in `~/AGENTS.md` ("Only for you") and four in
`team/AGENTS.md` ("The whole team"). Every line names the conversation of
the day it came from, and the team file says who reads it tomorrow. The view
shows the skill file itself: `before-i-go`, written by Alice on 2 Oct, three
numbered sentences.

## What changed and why

- **The skill and the diffs were hidden in the closed work.** Now the diffs
  are in the reply and the skill is in the view, so the point of the glimpse
  is on screen when the reader arrives.
- **The diffs are drawn in this block** (`b12-*` classes, tokens only), not
  with the kit's `diff()`: each added line carries a "from <conversation>"
  tag, which ties the lessons to the day the reader has just scrolled
  through, and each file has a footer saying who reads it.
- **Story (`did`)** rewritten: three words work because she wrote down once
  what they mean; the payoff is that Bob's agent knows the returns rule
  tomorrow without anyone telling it.
- **The work** now reads the skill file (shown whole, with its front
  matter), lists the day's nine conversations, has two thoughts (eleven
  candidates, seven kept; why four belong to the team) and two edits.
- The counts match `alice-day`'s sidebar line ("Saved: 3 for you, 4 for the
  team"); time and conversation id are unchanged.
- It stays her own skill throughout: the note under her message, the view's
  "Alice wrote this · 2 Oct", and "Three sentences. The whole skill."

## Assets

None.

## Sources and licenses

No third-party material.

## Assumptions about the product

- A person can keep a skill of their own as a `SKILL.md` with `name` and
  `description`, and saying its phrase is enough to run it.
- An agent reads `~/AGENTS.md` and a shared `team/AGENTS.md` when it starts,
  and `team/` is a folder the Example Studio accounts share.
- `skills/before-i-go/today.py` is a helper Alice's skill carries; it lists
  the day's conversations. If the product has no way for an agent to read
  the day's other conversations, this row and the first sentence of the
  skill need another wording.

## Engine needs

- See `alice-09-december-newsletter/NOTES.md`: built with `--only`, this
  block's page references the newsletter's pictures through the sidebar and
  the check fails on three missing files. With those copied in, the check
  passes.
- The kit's `diff()` takes plain lines. A per-line note (where the line came
  from) and a footer would let other blocks do this without their own markup.
