# Result

Implemented round 2 direction B: **[F] Ilmoita virheestä** sits beside
**Lopeta Esc**. A click opens **Palaute Habitatista**, releases the card and
suspends explanations while the panel is open. F still pins the pointed
part's card and focuses its report field. The following card has no visible
F reminder row; its short screen-reader hint remains.

Jari's additional decision of 22 November 2026 graduates the following card:
there is no `explain-follow` switch, settings/search entry or stationary-card
path. The earlier graduation in commit `a5e9ec986` supplied the pattern:
remove the gate and retired presentation, keep the default journey's tests.
Existing saved experimental choices need no migration; the generic preference
reader still accepts retired keys, which no longer control this feature.

`GeneralFeedback` is a reusable, separately catalogued component. Its caller
supplies an anchor and close callback; the Explain-specific instruction is
optional. General reports use the same public GitHub issue-form handoff,
version reader, copy-text fallback and no-referrer new tab as card reports.
The general form carries only the person's text, product version and language,
not a card or page context. Nothing is sent until the person submits on GitHub.

## Decisions for later review

- **Both modes versus one:** the initial implementation retained the hint in
  both desktop modes and the stationary card's part report button. Jari's
  subsequent graduation decision superseded that alternative: only the
  following presentation remains. Touch keeps its actual report button and
  no F hint in the bar.
- **Separate GitHub issue form, same channel:** the existing explanation form
  requires a card and asks specifically for an explanation correction. Reusing
  it with a fabricated card would contradict general feedback. Added
  `general-feedback.yml`, with the same note/version/language field IDs and
  no card. Its 1,200-character limit follows the accepted prototype.
- **Screen-reader hint remains:** the prototype explicitly retained a hidden
  F instruction at the end of the card's live region. Only the visible row
  disappears; removing the hidden instruction too would make the shortcut
  harder to discover without looking at the bar.
- **Cancellation follows the prototype:** Escape, Cancel and the close button
  discard the general draft. Outside presses preserve a nonempty draft and
  show a reminder; an empty or handed-off panel closes without activating the
  underlying part. Keyboard departure from an empty panel closes it. Explicit
  bar actions can leave the panel. No confirmation dialog or persistence added.
- **Explain's own controls do not explain themselves:** the hint's accessible
  description explains F versus clicking; the panel gives immediate guidance.
  These use the existing own-UI exclusion rather than recursive explain cards.
- **Review level:** focused source/diff self-review plus interaction, accessibility
  and visual evidence. No session lifecycle, wire contract, daemon state or
  authorization boundary changed; the Go-side change only removes a catalogue
  entry. No independent model review was required or claimed. Self-review kept
  lasting keyboard actions blocked even when focus leaves the nonmodal panel.

## Verification

Tested the implementation committed with this result, based on `03cd41490`.
All CPU-heavy commands had timeouts and scratch leases; browser workers were 2.

- `./scripts/test-focused.sh --area web`: passed static/catalog checks and
  **255 test files / 2,143 tests**, including ExplainMode and feedback tests.
- `./scripts/test-focused.sh --area go --go-package ./internal/experimental`:
  passed compilation; this package has no Go test files.
- Focused browser runner with `lab-explain-mode.spec.ts`,
  `lab-explain-follow.spec.ts` and `settings-experimental.spec.ts`: exercised
  the changed journeys. Final direct named-spec Playwright runs with
  `--repeat-each 3`, reply jitter 0–60 ms, private scratch and 2 workers passed
  **72 lab cases and 12 settings cases**. No whole suite or clean gate ran.
- General-panel cases check keyboard activation/focus return, releasing the
  selected card, draft preservation on outside presses, empty dismissal,
  part-free GitHub query parameters, 700 px layout and axe in Finnish/English.
  Existing cases retain pointer pass-through, edge placement, reduced motion,
  pinning, report previews and handoff, lasting-action blocking and touch.
- Removed only stationary-mode tests: `inPath` hull geometry, travelling to a
  stationary card footer, and the switch-off report button. Those behaviours
  no longer exist. Following-card pointer pass-through and F reporting remain
  covered in `lab-explain-follow` and ExplainMode unit tests; the existing
  GitHub privacy/handoff test was adapted, not removed.
- `python3 scripts/generate-ui-reference.py --check`, project-view validation,
  `issuectl doctor --json` and `git diff --check`: passed. Reference regeneration
  also reconciled pre-existing integration-copy drift with its existing source;
  it changes no integration behaviour.

The first browser attempt lacked the Pi SDK fixture; installed the pinned
fixture dependency and reran. Development checks also exposed a missing JSDOM
hit-test stub and a test's outside-click coordinate covered by the panel;
corrected both and reran successfully. Neither is an outstanding failure.

Synthetic screenshots and paired offline HTML are outside git at
`/var/tmp/agent-keep/explain-f-hint-impl/`. The `general-{fi-FI,en-US}-{light,dark,contrast}`
and `general-{fi-FI,en-US}-narrow` captures show the panel and bar at 1440 and
700 px; source/diff and image review checked the accepted direction, wording,
focus and fit. Browser tests cover the unchanged touch report at 390 px.
Logs are `web-final.log`, `repeated-final.log`, `go.log` and `doctor.json` there.
These are synthetic host/browser checks, not live-installation or real GitHub
submission evidence. Nothing was deployed or pushed by this worker.

## Live check

After deployment, enter Explain mode without enabling an experiment. Point
at several parts: the card follows without a visible F row. Press F and type
immediately; Escape releases the report, a second Escape ends the mode.
Open the bar hint after pointing at a top-bar part: the card disappears and
**Palaute Habitatista** names no part. Type a draft and press outside: it stays.
Open GitHub and inspect the prefilled general feedback without submitting it;
there must be no card field or page context. Escape returns focus to the hint.
On a phone, verify the sheet's report button and absence of the desktop hint.
