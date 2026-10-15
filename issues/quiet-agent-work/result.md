# Quiet agent work — result

The production conversation now starts a working Pi turn with its work folded behind one stable information row. The reply remains visible; the reader can toggle the work without the button moving. Saved/history turns start folded. Live tool blocks open while streaming and fold on completion unless the reader has chosen otherwise. The account menu stores the work default on this device, alongside the theme.

## Decisions for later review

- **Preference scope:** `nah:agent-work` in browser localStorage; alternative was host state or session storage. This is presentation, not a host fact, and should survive reloads on this device. A changed preference affects newly mounted live turns; it does not override a reader's choices in an already mounted turn. Saved history always starts folded.
- **Clock without `turn_start`:** fall back to the first observed provisional turn in this view, keyed by the controller's command ID; alternative was to omit the time. A partial journal tail can lack the native start event, but a useful elapsed display is still possible. The number is relative to first observation in that case, not a claimed native start time.
- **Scroll intent:** wheel/touch/scrollbar/keys establish reader intent; a disclosure's height change and browser scroll clamping do not. Idle gestures expire if they never scroll. Returning to the bottom resumes following. Alternative was inferring intent from every `scroll` event, which breaks on collapsing work.
- **Animation:** use CSS stagger on the revealed work children rather than imperative animations; reduced-motion disables it. This keeps the React disclosure and its scroll compensation in one synchronous commit.

## Visual comparison

The paired synthetic-lab screenshots and static HTML are `working-closed`, `working-open`, `working-phone`, `settled`, and `settled-phone` in this directory. `reference-desktop.png`, `reference-open.png`, and `reference-phone.png` are headless Chromium captures of the checked-in prototype. They were compared at 1440 × 900 and 390 × 844. The prototype centers a fixed-size stage with a scripted longer transcript and recap; the lab renders the full-width production shell with invented native Pi data, so stage position, title, model and transcript contents cannot pixel-match. The closed row's ordering, button width, status, phase and clock match the design; the opened lab turn at this fixture point has no separate provisional tool work (the fake Pi has already written that use into native history), while the prototype script has multiple steps. This content difference is justified rather than faked in production. The settled lab capture is an interrupted synthetic turn after Stop, not the prototype's successful completion; it verifies folding and the summary head but the host correctly presents its uncertain stop separately. Phone layout retains the same row and readable reply without a horizontal overflow. The prototype's button is a bespoke `<button>`; production uses the shared `ControlButton` and its existing focus treatment.

## Verification

- `./scripts/test-web-fast.sh`: passed on the final source tree before commit.
- Host-backed synthetic Playwright: `quiet-work.spec.ts` (same button element over two ticks, toggle every click, opening within 1 px, reduced motion, axe) and `browser-conversation.spec.ts` (including follow, saved fold, preference reload): passed. `lab-conversation.spec.ts` passed 12/12 after adjusting its expectations for the folded default.
- Focused final-diff review: one Claude Fable 5.1 finder pass on the UI diff (routine risk; no contracts or security authority touched). Its concrete follow-intent, resume, snap, initial tool expansion, live clock and status announcement findings were fixed and checked with browser/component tests. No second-model verifier was warranted after the fixes left no outstanding candidate.
- Full gate: `./scripts/ci-local.sh --clean --json` is run against the clean committed tree; its git-common-dir receipt identifies the tested tree. (See the run's final report for the result.)

No UID-isolation or real Pi behavior is claimed by these synthetic checks.
