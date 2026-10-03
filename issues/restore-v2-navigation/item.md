---
created: 2026-10-01
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 14
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@restore-v2-conversation', '@show-pi-dialogs', '@unify-ui-primitives']
---

# Fit sidebar, account menu and return view to the draft

## Goal

Fit navigation to the draft with the restored rules from
@restore-v2-conversation: sidebar rows (open, collapsed, phone drawer), the
⌂ Etusivu row, account button and menu, and the return view ("Jatka siitä,
mihin jäit" with "Käynnissä" / "Viimeksi avatut"), desktop and 390 px, both
themes.
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

The [design](../../design-system/design.md) describes the shared presentation:

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

## How acceptance works

Use a fresh lab and a deterministic fixture that shows the draft's states:
at least one running conversation with tool rows and two queued items, one
answered, one read-only, no duplicates. Refresh the pairs with
`web/lab/compare-design.mjs` and put the before/after pairs in this issue
folder. The conductor reviews the pairs against the draft before the issue
counts as done; write the issue's result so that the pairs are the first
thing a reviewer sees.
## Design sources

- Benchmark: [design](../../design-system/design.md) and the
  drafts in `../../design-system/drafts/`; the
  [assessment](../review-browser-design-v2/assessment.md) explains the gaps
  and the [first reading](../review-browser-design-v2/first-read.md) the
  known behavioural differences.
- Phone layouts are included. Shared sizing is defined in the design tokens.
- Agreed repository-chooser default: all repositories visible, time filtering
  is the user's choice.
- Keep existing state handling, polling, session binding, drafts, reading
  position and uncertain-send honesty. Where the draft contradicts
  `docs/ui.md`, `docs/interfaces.md`, `design-system/design.md` or the
  state machine, do not resolve it silently: record the deviation in this
  issue and follow the existing agreement.
- Only existing `--ah-*` colour tokens. Icons must not depend on the system
  font. Every new or changed component has a story in both themes.
- Evidence comes from the synthetic lab (`web/AGENTS.md`), never a real
  server. Redact anything personal from screenshots kept in the issue folder.
- Ownership tonight: this work may change `web/`, `design-system/`,
  `docs/ui.md` and `docs/design-system.md`. A needed change in `internal/`,
  `contracts/` or other docs is recorded in this issue as a request instead.
