# Result

## What was silent

Traced press → `useCompaction` → `POST /compact` → daemon `compact` → Pi's
RPC `compact` → Pi's `compaction_start`/`compaction_end` events → journal
`pi.marker` → browser, and Pi's compaction entry → history.

Reproduced in the synthetic browser host (screenshots before the fix):

- The context page did show "Agentti tiivistää keskustelua…" and every
  outcome, but only on that page. The page replaces the conversation, so
  once the person goes back to the conversation nothing said that the agent
  was compacting: no row, only the ring's small spinner. A failure's reason
  was shown nowhere but on the page, and a failure in a tab that did not
  press (or after a reload) was shown nowhere at all.
- Pi's `compaction_end` carried no outcome across the daemon; the browser
  could not tell a finished compaction from a failed one.
- The finished compaction's mark in history was "Tiivistys · <whole
  summary>": one raw row with Pi's full Markdown summary inline, no time.

Whether Pi actually compacted conversation
`pi:be649ddf-7886-4cf5-8fe0-cfcf37720401` on pilot.657 cannot be seen from
here: the test server is not reachable from this worker. The daemon logs
every attempt as a `conversation_compact` line with its `outcome`
(`done`, `already_compacted`, `nothing_to_compact`, `cancelled`, `failed`,
`uncertain`), and Pi's session file gains a `"type":"compaction"` entry on
success. If the line says `uncertain` with no compaction entry, Pi did not
answer within ten minutes or the channel failed; that path now shows its
notice in the conversation too.

## Fix

- Daemon: `compaction_end` publishes `outcome` (done / already_compacted /
  nothing_to_compact / cancelled / failed); Pi's error text stays out.
  Contract `event.schema.json` `pi.marker.payload.outcome`.
- Conversation: a status row at the end of the conversation while the agent
  compacts (from the press at once, and from Pi's marker for any compaction,
  including Pi's automatic one), and the reason when it did not compact.
- History: Pi's compaction entry is "Keskustelu tiivistettiin klo HH.MM"
  with the summary folded under "Yhteenveto".
- Pi's compaction markers survive the saved answer (daemon journal tail,
  browser reducer, settled history read): Pi compacts automatically after
  the answer and before the turn settles, so the answer's history entry
  used to wipe the marker and with it the failure notice. The markers no
  longer appear as raw live signals.
- Explain card K22 for both rows.

Review: independent `/llm-review` (GPT-6 Astra finder, Claude Fable 5.1
verifier) + `/assess-findings`; two confirmed findings (marker retention and
a stale request outcome overriding Pi's later end), both fixed here.

Evidence: `conversation-context-view.spec.ts` (failure with reason, progress
on the page and in the conversation, the mark), `compactionNotice.test.ts`,
`CompactionNotice.test.tsx`, `TestCompactionEndCarriesItsOutcome`, and
`TestCompactThroughPinnedPi` now checks the pinned Pi's own `compaction_end`
frames classify as `nothing_to_compact`, `done` and `already_compacted`.

## Decisions for later review

- **The progress/failure row also shows for Pi's automatic compaction and
  with the context-view experiment off.** Alternative: only for the page's
  press. Chosen because the issue asks for compaction to show as it does in
  Pi's terminal, and the row derives from Pi's own markers.
- **The failure row stays until the next turn starts** (no dismiss button).
  Alternative: a close control (another control and Explain card). The
  next message clears it, which is when it stops being current.
- **Reused the context page's sentences** for the conversation row, so the
  two places say the same thing; "uncertain" still mentions "Sivu".
- **The mark folds Pi's summary as plain text** (pre-wrapped), not rendered
  Markdown, to keep the row light.
