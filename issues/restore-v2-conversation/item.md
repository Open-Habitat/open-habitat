---
created: 2026-10-01
updated: 2026-10-03
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 12
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
closed: 2026-10-01
closed_by: night-ui-worker
---

# Restore v2 presentation rules and fit the conversation to the draft

## Goal

Restore the v2 presentation rules in the shared primitives and fit the
conversation view to the draft: header, transcript, tool rows, queue,
receipts, composer and notices, desktop and 390 px, both themes. Fix the lab
fixture first so the states are representative.
## Why this exists

Jari reviewed the night's lab captures (`issues/compare-v2-pairs/`) on
2026-10-01 and judged them far from the design. The slices passed the gate and
metric assertions but broke the draft's composition and its presentation
rules. Visual fidelity to the draft is the bar.

Concrete failures seen side by side with the draft (working, home, settings
at 1440 px):

- Every sidebar row spells out "Prosessin tila ei tiedossa · Vain luku";
  the draft shows a hollow ring and a short right-aligned "vain luku" only.
- The conversation has three lines of help text under the composer, a
  "Viesti Pi:lle" label, a "Viesti hyväksyttiin Pi:n RPC:ssä; vuoro ei
  välttämättä ole valmis" banner, a "Tarkista keskustelun tila" link and
  a "Jonossa 2" button; the draft has one quiet hint line, no label and no
  default-state notices.
- The queue renders as a large "Työskentelyjono" heading with numbered
  lists; the draft has a compact "ODOTTAA PI:TÄ · 2 · TYHJENNÄ JONO" header
  and one tinted row per item.
- Tools render as prose ("Työkalu: bash") instead of the draft's bordered
  tool rows with status mark and duration.
- The header stacks breadcrumb link, title, two status labels and Tiedot;
  the draft has one line: title, a status pill, Tiedot ▾ at right.
- The lab fixture accumulates duplicate "hidas tarkistus" conversations and
  has no running conversation, which makes every view look broken.

## Rules that win

The handoff's "Ilmeen säännöt" are binding, and the draft's vocabulary is
the way to be honest:

- Only deviations show. Default states (ready, browser control, queue 0,
  accepted send, unknown-but-normal process state) are not written out.
- Status = mark + word + colour from one component; read-only = hollow ring
  or dashed border, not a sentence.
- One primary button; secondary actions are quiet text buttons; no help
  text inside buttons; shortcuts appear only in one hint line.
- Honesty constraints from earlier agreements (no fabricated state, no
  auto-resend, uncertain sends visible) are met with the draft's own
  elements (dashed bubble with "? Ei tiedossa …", hollow ring), never with
  added explanatory prose. Where the host lacks a fact, omit the element
  rather than explain its absence.
- The deviation list I1–I6 in `issues/compare-v2-pairs/index.md` is
  superseded wherever it justified added text or controls; keep only the
  substance (no invented data, no auto-resend).

## Acceptance Criteria

- [x] Synthetic lab pairs cover working, completed, rejected, disconnected, read-only and new conversations in both themes at desktop and 390 px; phone new/rejected use the nearest available layout reference, as noted in `result.md`.
- [x] The fixture holds a running tool with two queued messages, hydrates prior history for uncertain send, and cleans generated sessions between captures.
- [x] The committed implementation passes the clean gate and issue validation.

## How acceptance works

Use a fresh lab and a deterministic fixture that shows the draft's states:
at least one running conversation with tool rows and two queued items, one
answered, one read-only, no duplicates. Refresh the pairs with
`web/lab/compare-v2.mjs` and put the before/after pairs in this issue
folder. The conductor reviews the pairs against the draft before the issue
counts as done; write the issue's result so that the pairs are the first
thing a reviewer sees.
## Shared context for every design-v2 slice

- Benchmark: [handoff](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v2/handoff.md) and the
  drafts in `../../design-system/drafts/v2/vedokset/`; the
  [assessment](../review-browser-design-v2/assessment.md) explains the gaps
  and the [first reading](../review-browser-design-v2/first-read.md) the
  known behavioural differences.
- Provisional decisions for the night of 2026-09-30 (recorded on
  @review-browser-design-v2; Jari may overturn them): phone width is in scope,
  and the v2 sizing table is the source of the shared values.
- Agreed repository-chooser default: all repositories visible, time filtering
  is the user's choice (not the handoff's monthly default).
- Keep existing state handling, polling, session binding, drafts, reading
  position and uncertain-send honesty. Where the draft contradicts
  `docs/ui.md`, `docs/interfaces.md`, `design-system/production-v1.md` or the
  state machine, do not resolve it silently: record the deviation in this
  issue and follow the existing agreement.
- Only existing `--ah-*` colour tokens. Icons must not depend on the system
  font. Every new or changed component has a story in both themes.
- Evidence comes from the synthetic lab (`web/AGENTS.md`), never a real
  server. Redact anything personal from screenshots kept in the issue folder.
- Ownership tonight: this work may change `web/`, `design-system/`,
  `docs/ui.md` and `docs/design-system.md`. A needed change in `internal/`,
  `contracts/` or other docs is recorded in this issue as a request instead.

## Implementation deviations and host requests (2026-10-01)

- The native-history projection currently flattens an assistant message's
  tool call into text such as `Työkalu: bash`, and emits tool results separately
  without the command, exit code or duration needed for the draft's structured
  command/tool rows. The browser does not parse that prose to invent a command,
  duration or result. **Request to the internal/contracts worker:** expose the
  native tool-call/result relationship and observed command/duration/exit data
  through the validated history contract; until then the bordered result row
  shows only the tool name and actual result status. A missing duration is not
  displayed as zero or guessed from arrival time.
- The existing synthetic lab's `conversations-reset` replaces the controller,
  but leaves every fake Pi JSONL session on disk. `history?mode=ready` rewrites
  only the original seeded session, not newly created conversations. Repeating
  the comparison's create/send journey accumulates duplicates in the sidebar.
  The fake Pi's `hidas` turn also settles before two queue commands and the
  screenshot complete at 1440 px. **Request to the internal/test worker:** add
  a lab-only deterministic reset that removes only synthetic generated session
  files, and a barrier-controlled running fixture with two queued items and a
  real tool call, plus answered and read-only history. Do not change the
  production contract or insert screenshot-only fake DOM. This worker is barred
  from modifying `internal/`, `contracts/` and `test/browser-host/`.
- `Vain luku` for an unverified historical process remains read-only without
  claiming it was started in a terminal. The draft's terminal attribution and
  sample exit code are not facts available for this specific history, so those
  are omitted. The history page links to the workspace's actual new-conversation
  action instead of starting/resuming this read-only history.
- The actual synthetic native history contains a `model_change` entry, and
  model-change events remain visible in the timeline; the illustrated draft
  has no corresponding event. We do not silently drop a native history event
  to make unrelated fixture content resemble the draft.
- On a 390 px screen the `Tiedot` action remains a 44 px keyboard/touch target
  beside the status, rather than disappearing as in the phone draft; the
  existing technical-facts disclosure must remain reachable without a desktop
  pointer.
- The disconnected lab capture also currently has no hydrated conversation: the
  offline transition happens on an empty new-conversation route, while the
  illustrated disconnected draft retains a prior transcript and an uncertain
  send. This pair shows offline controls but cannot validate the illustrated
  timeline. A faithful scenario needs a synthetic preloaded conversation and
  send-ack uncertainty before the disconnect; it cannot be inferred from a
  screenshot of a new route.
