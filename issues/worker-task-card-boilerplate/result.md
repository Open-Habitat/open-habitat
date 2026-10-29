# Result

- **Task first.** `splitBrief` (`web/src/app/spinoffs.ts`) separates the run
  context Taskfleet puts before every worker's prompt (from `# Taskfleet run
  context (read first)` to its closing `---` / *The original task brief
  follows.*) from the main agent's task. The brief card (`WorkerBrief`)
  shows the task and puts the context under it in a closed *Taskfleetin
  ajo-ohje workerille* disclosure. The same card is used whether the brief
  comes from the run's `prompt.md` or from the first message of the
  worker's history. A prompt without that context is shown as it is.
- **No empty space above.** A worker's conversation has no composer, so its
  stream is no longer bottom-anchored: a short one starts at the top.
- **Kysy.** The band's chip goes straight to the main conversation; the
  dialog whose only action did the same is gone.

Tests: `WorkerBrief.test.tsx`, `spinoffs.test.ts`, the updated
`spinoffs.spec.ts` and `worker-view.spec.ts`.

## Decisions for later review

- **Chip navigates rather than becoming a plain label.** Jari offered both.
  A label that looks like a pill invites a press; making it the one-press
  route keeps *Kysy* meaningful on the phone, where the band's parent
  button is only an arrow and the conversation title. The harness-specific
  explanation the dialog gave (a Claude worker cannot be messaged mid-run)
  is dropped; the main agent knows it.
- **Split in the browser.** The daemon still serves the prompt as it is;
  the browser knows Taskfleet's preamble shape. Alternative: a separate
  `brief_context` field in the contract, which would also need the history
  path's first message split on the daemon side.
