---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@restore-v2-conversation']
lane: design-v2
lane_seq: 12
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
closed: 2026-10-01
closed_by: night-ui-worker
---

# Close remaining conversation differences from the draft

## Goal

Close the remaining differences the conductor found when reviewing the
@restore-v2-conversation pairs (`issues/restore-v2-conversation/pairs/`)
against the draft on 2026-10-01:

1. **Progress placement.** In the working state the "Pi työskentelee… · 0 min
   1 s / Valmistelee seuraavaa vaihetta" block renders above the user's
   message. The draft shows progress at the end of the running turn as one
   quiet line with a pulsing dot ("Käyttää työkalua bash · 5 s").
2. **Tool rows.** A running tool renders as "bash · Käynnissä" in a plain box.
   The draft row has a bold verb/tool name, the command or path in mono, and
   at right a status mark plus word and duration ("● ajossa 5 s",
   "● ✓ 9/9"), with the shared tool-row padding and border. Use what the
   host provides (tool name, arguments summary, start/finish); omit, don't
   invent, missing parts.
3. **Phone queue.** At 390 px the queue header and rows touch the left screen
   edge; they must share the transcript column's gutter.
4. **Disconnected.** The lab shows a top "Ladataan palvelimen tilaa" strip, a
   large "Yhteys katkesi" card with "Yritä uudelleen", a "Tarkista keskustelun
   tila" link, a composer hint "Odota vahvistettua joutotilaa…" and a
   truncated "Tiedot voivat olla vanhoj…" in the rail header. The draft has
   one thin banner across the top of the app with **Yhdistä**, the uncertain
   send as the dashed bubble under the message, and nothing else. One banner,
   one action; the rail header keeps its normal connection dot.

Also check completed, rejected, read-only and new states for the same kinds
of leftovers and fix them. Refresh the conversation pairs.

## Acceptance Criteria

- [x] All four points fixed in both themes at desktop and 390 px; pairs
  refreshed in this issue folder next to the draft frames.
- [x] No behaviour regressions (no auto-resend, uncertain visible, continue
  only on eligible); browser tests updated to roles/names, not prose.
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

## How acceptance works

Use a fresh lab and a deterministic fixture that shows the draft's states:
at least one running conversation with tool rows and two queued items, one
answered, one read-only, no duplicates. Refresh the pairs with
`web/lab/compare-v2.mjs` and put the before/after pairs in this issue
folder. The conductor reviews the pairs against the draft before the issue
counts as done; write the issue's result so that the pairs are the first
thing a reviewer sees.
## Shared context for every design-v2 slice

- Benchmark: [handoff](../../design-system/drafts/v2/handoff.md) and the
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
