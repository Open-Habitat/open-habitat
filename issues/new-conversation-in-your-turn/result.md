# Result

A conversation whose Pi has written no history yet — opened with + and still
empty — is now the person's turn: it shows in Sinun vuorosi, not in
Hiljaiset (`web/src/app/railNow.ts`). It leaves when the first message is
written: the turn makes it Käynnissä, and the answered conversation follows
the usual reply rules (a reply read leaves Sinun vuorosi with Nosta ja Ei nyt
off and waits there, read, with it on). With Nosta ja Ei nyt on, Ei nyt on
the row moves the empty conversation to Hiljaiset (the mark names no reply).
A Pi that crashed before writing stays in Käynnissä as failed.

Evidence: `railNow.test.ts` (*puts a new conversation in Sinun vuorosi until
its first message is written*: empty, at work, crashed, Ei nyt) and the
browser case `rail-now.spec.ts` *a new conversation waits in Sinun vuorosi
until its first message* against the real gateway and daemon (+ opens it into
Sinun vuorosi; written and read, it is quiet again with the feature off).

## Decisions for later review

1. **"New" means Pi has written no history** (`history: "missing"`), not
   "no reply yet" or "titled *Uusi keskustelu*". Alternatives: any
   conversation without `last_reply` (would also lift old terminal
   conversations whose Pi no longer runs, since the reply is read only
   while Pi runs or rests), or the placeholder title (a native session file
   without a first message would also count). A just-started conversation
   after its first answer is covered by the reply rules, not by this one.
2. **The row's mark is the agent's state** (a resting Pi's green ball), not a
   turn ball: the issue asks only for the section, and `raise-rail-only`
   keeps the status mark to the agent's state.
