# Result: setting a wake no longer moves the conversation to Hiljaiset

Delivered on 2026-11-28, run `01m8g7grq6tnpf8kwxa80cdbpk`.

## Change

- `wake create` (`createWake`) no longer chooses `quiet`, and its reply no
  longer carries `agent_section`; the field is removed from
  `agent-wake.schema.json` and its example.
- The archive notice's undo no longer puts the conversation in Hiljaiset.
  Archiving clears the agent's section choice and keeps no copy of it, so
  forcing `quiet` did not restore what the person had; the restored
  conversation takes its ordinary place, and the wake comes back as before.
- The ordinary rule applies: after a reply the conversation is in Sinun
  vuorosi. An agent whose turn only waits for its wake and asks nothing sets
  `section update --current --section quiet` itself. That command already
  accepted `quiet` during the agent's own turn; only the wording ("only when
  the person asked") changed.
- The agent guide (`host-context.md`), the agent skill, `wake create` and
  `section update` help, the snapshot schema's `wakes` description and the
  design note say this. A pending wake shows its time on the row in whichever
  section it stands.

## Tests

- Daemon: creating a wake leaves the section untouched and the reply has no
  `agent_section`; the archive undo restores the wake without choosing a
  section. `./internal/daemon`, `./internal/cli` pass; contracts clean.
- Browser: `scheduled-wake.spec.ts` now sets `quiet` explicitly after the
  wake, as an agent that only waits would, and the row still shows the wake
  time in Hiljaiset; the archive undo test finds the wake time on the row in
  any section. `agent-section.spec.ts` passes. `scripts/test-web-fast.sh`
  passes.

## How to try

In a conversation, ask the agent a question and ask it to set a wake in the
same turn (for example "muistuta huomenna kymmeneltä, ja kysy minulta ensin
kumpi aika sopii"). When the reply arrives, the conversation stays in Sinun
vuorosi with the wake time on its row. Asking only for a reminder ("muistuta
huomenna kymmeneltä") lets the agent place it in Hiljaiset itself.
