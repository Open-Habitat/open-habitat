# Result

Conversation list now includes a string `title` in every row, both in
`data.result.sessions` JSON and JSONL exports. It shares the rail's title
selection: native session name, first-message preview, then `Uusi keskustelu`.
Manual names win over automatic titles because the native naming operation
preserves them. No Pi starts and no new title store is introduced.

## Decisions for later review

- Use one display string rather than raw manual/automatic fields: Pi has one
  native name, not separate durable authorities for those sources.
- Keep the existing daemon-held inventory rather than expand to every native
  history. `history list` remains native-history discovery.
- Do not add a title flag: exact or substring filtering is already a short
  `jq` expression, documented in the shipped skill. Titles are not unique IDs.
- Preserve handle discovery when history is unreadable or ambiguous, using the
  same controller-only name fallback as the rail. Reuse the existing
  stamp-invalidated session facts cache rather than add repeated title scans.

## Verification

- Focused Go suites: `./internal/daemon` and `./internal/cli` passed.
- Regression coverage: native automatic/manual names, latest rename, first
  prompt, unnamed and pre-history names, duplicate IDs, unreadable inventory,
  direct and cached readers, CLI JSON envelope and JSONL title preservation.
- Independent review: claude-fable-5-2 finder and gpt-6-astra verifier, followed
  by local assessment. Three concrete findings fixed: recovery failure on
  inventory errors, cache bypass, ambiguous histories replacing given names.
  The small CLI transport test seam was subsequently self-reviewed and tested.
- No browser UI or generated schema changed; no browser suite or live
  installation test was run. This response has no contracts/v1 schema.

Live check: on the test server, run `open-habitat agent conversation list
--json` and compare a manually named and automatically titled conversation's
`data.result.sessions[].title` with the rail. Rename one and list again; use
its returned `agent_id` as the explicit target for other commands.
