# Result: detailed context status, round 1

Prototype: [prototypes/context-detail/index.html](prototypes/context-detail/index.html)
(one offline file). Jari's notes, including the per-fact source table:
[prototypes/context-detail/NOTES.md](prototypes/context-detail/NOTES.md).
Source round: `design-system/prototypes/rounds/2026-10-26-kontekstin-erittely/`
(library app frame, the accepted Rengas ring in the top bar).

## What the round compares

The axis is **where the detail opens and how much of it shows at once**. The
content is the same in every direction: the composition (instructions and
system prompt, tool declarations, compaction summary, conversation, tool
output, attachments), what the next compaction would replace with a summary,
earlier compactions, and context size per turn.

| Direction | Where | What it decides |
| --- | --- | --- |
| Ponnahdus | The ring's existing popover grows; bottom sheet on a phone | Everything at a glance, closes on any outside click |
| Paneeli | Side panel beside the conversation; full screen on a phone | Stays open while the agent works; details behind disclosures |
| Kartta | The conversation becomes a list of turns, grouped into summarised / next to be summarised / kept | Answers "what will the next compaction take" turn by turn |
| Sivu | Own page with tables of parts, compactions with full summaries and files, and every turn | Room for everything, leaves the conversation |

## What the host would need

The finding that shapes all directions: **Pi 1.3 records nearly everything in
the session file**, so no new RPC and no running Pi are needed (same as the
ring):

- Prompt sections by name (skills, project context, rules…) and tool
  declarations are persisted as `system` messages; compaction entries keep a
  full system checkpoint. The history reader does not forward them today.
- Part sizes can only be estimated: Pi measures the whole context per reply
  (`usage`), and its own `estimateTokens` (chars/4) sizes messages. The detail
  must say the total is measured and the parts estimated; after a compaction
  even the total is an estimate until the next reply.
- Compaction entries carry `tokensBefore`, `summary`, `firstKeptEntryId` and
  `details.readFiles/modifiedFiles`; the browser gets only the live marker
  today. The **reason** is only in the live `compaction_start` event, not in
  the file.
- The next compaction is Pi's pure `prepareCompaction(pathEntries,
  settings)`; `keepRecentTokens` (default 20 000) is read from Pi's settings
  like the reserve already is. The implementation should call Pi's function
  through the existing Pi helper rather than reimplement the cut rule.
- Per-turn input / cache / output / cost are in each reply's `usage`; only
  `context_tokens` is forwarded now. Only Sivu needs the rest.

Claude Code exposes a native category breakdown (`/context`) and records
`usage` and `compact_boundary` in its transcript, but the host runs Claude
models through Pi's Claude bridge and does not read Claude Code transcripts.
Open for implementation: whether Pi's recorded prompt sections match what the
bridge actually sends to Claude. The round did not verify this.

## Recommendation: Paneeli

The detail is consulted to decide what to do next while the agent works:
compact now, start a new conversation, or stop rereading a huge log. That
needs it beside the conversation and live, not in a popover that closes on the
first click (Ponnahdus) or in a view that hides the conversation (Kartta,
Sivu). Paneeli also carries Kartta's best idea in compact form: the turn strip
that shows what is already summarised, what goes next and what stays. Its
disclosures keep the first view as short as the popover while the detail
remains reachable. On a phone it becomes a full-screen sheet, which is what
the production ring details dialog already does. Cost: the app frame needs a
side-panel slot, and 360 px less conversation width on desktop while open.

Second choice: **Ponnahdus**, if Jari wants the smallest step from what is in
production now and rarely needs more than the six parts and one sentence
about the next compaction. Kartta is the strongest explanation of compaction
and could later be the panel's "show turns" mode. Sivu suits investigation
after the fact but is heavy for the everyday question.

## Questions for Jari

- Which direction?
- Is the estimate honest enough: measured total, estimated parts (chars/4),
  stated in the detail? The alternative is to show only what Pi measures,
  which is the total and the per-turn usage.
- Does Sivu's per-turn table (input, cache, output, cost) earn its place,
  or are size per turn and growth enough?

## Verification

`verify.mjs` builds the page and checks 4 directions × 5 scenes × 1440/390 px ×
light/dark (80 cases). In each case it opens the detail from the ring and
checks:

- focus moves to the title, and Escape closes it and returns focus to the ring
- nothing overflows horizontally and the detail stays inside the frame
- no `undefined`, `NaN` or `null` appears in the text
- the parts add up to the headline number
- the first disclosure opens
- the picker contract holds, with no console errors and no network requests

Screenshots at device scale factor 2 are in
`prototypes/context-detail/evidence/`. No production code changed.
