# Result

The per-person limit is now a fixed host-protecting cap of 32 daemon-owned Pi
children (`defaultLiveConversations`), read only through
`ConversationController.liveLimit()` so a later setting can feed it through
the `maxLive` field. The definition of busy and idle-child yielding are
unchanged; the boundary tests keep running at a limit of four through the
harness, and `TestMoreThanTenConversationsWorkAtOnce` holds twelve running
turns at the production default.

Review: `/llm-review` (gpt-6-astra finder, claude-fable-5-1 focused
false-negative check on the locking) and `/assess-findings`: one comment
accuracy fix applied (the cap is per person, not host-wide), one pre-existing
candidate dropped (temporary title-generation Pi not counted).

## Decisions for later review

- **Fixed cap 32, not a memory condition.** Alternative: refuse when the
  person's slice or the host lacks available memory. A fixed number is exactly
  testable; a memory reading moves with every other process on the host and
  would refuse at random, and the installation sets no per-person memory limit
  to read. 32 × ~210 MiB ≈ 7 GiB per person.
- **Refusal text without a number.** Alternative: the daemon reports the limit
  so the text can name it. That would add a contract field for a value that
  is far above ordinary use; "Too many conversations are already working at
  once" / "Liian monta keskustelua työskentelee jo yhtä aikaa" suffices. If the
  setting prototype makes the limit person-chosen, reporting it becomes worth it.
- **Recap still leaves one place free** (limit − 1), unchanged in kind.
