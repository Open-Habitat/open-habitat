# Phone account menu: implemented

The selected A sheet is implemented in `7392053627842411f9231d161b070f9e58e9102c`, without an experiment switch. Desktop keeps its popover. On phones, the menu spans the bottom edge with touch-sized rows, a grip and the existing quick controls. Feedback opens above it; Back returns to the menu, and dismissing the menu returns to the still-open drawer.

Browser Back also dismisses one layer. Feedback text survives Back in the mounted account shelf; Cancel clears it. Outside taps, Escape and downward drags protect an unfinished feedback draft with the existing nudge. The menu dismisses by scrim tap, Escape or downward drag. Settings actions wait for history dismissal before navigating, including the sound row's night-settings shortcut.

## Verification

Tested the runnable sources of `7392053627842411f9231d161b070f9e58e9102c` under `umask 077`, bounded timeouts and the shared scratch lease:

- `./scripts/test-focused.sh --area web`: static checks, TypeScript and **261 files / 2,199 tests passed**. Two new hook tests check single dismissal while Back is pending, navigation only after dismissal, and native Back from feedback without a second traversal.
- `OH_PORT_BASE=23800 OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-phone-account-sheet.spec.ts --spec lab-sidebar-account.spec.ts --spec lab-phone-header.spec.ts --spec account-sound-reasons.spec.ts`: **10 lab cases and 4 ordinary cases passed**.
- Named lab specs above through Playwright with `--repeat-each 3`, two workers, 0–60 ms reply jitter and a leased private TMPDIR: **30/30 passed**.
- New phone journey covers 320×568 and 390×740, full-width bottom placement, quick choices remaining open, feedback and menu axe checks, draft protection and retention, Back button and browser Back, focus restoration, scrim/Escape/drag dismissal, and Settings navigation followed by Back without reopening a stale sheet.
- Existing account-menu cases still cover Finnish/English Explain cards, desktop keyboard use and role-based actions, and light/dark phone captures. Sound cases cover the phone night-settings link as well as desktop behavior.
- `git diff --check`, `issuectl doctor --json` and `python3 scripts/validate-project-view.py` passed.

Initial runs exposed a missing local Pi fixture dependency and occupied test ports; installing the pinned fixture and selecting a free port resolved those prerequisites. During development, tests caught automatic menu dismissal when opening feedback and double dismissal of the night-settings link. Both were corrected and the final checks above rerun.

### Visual evidence

Synthetic host only; no real installation data. Paired PNG/static HTML and logs are outside the repository at `/var/tmp/agent-keep/account-menu-phone/`:

- `sheet-320`, `sheet-390`, `feedback-320`, `feedback-390`;
- `phone-light`, `phone-dark`, `feedback-phone-light`, `feedback-phone-dark`, `desktop-light`, `desktop-dark`;
- `card-fi-FI-390`, `card-en-US-390`, and desktop card captures;
- `web-final.log`, `browser-final.log`, `browser-repeat-final.log`.

The phone sheet and feedback captures were inspected for width, reachability and layering; the English phone Explain card was inspected for fit. The browser assertions, not the mere existence of captures, establish interaction results.

### Review

Focused source-grounded self-review, proportionate to browser-only presentation and transient history state. Reviewed modal containment and focus, Back/action ordering, draft lifetime, the unchanged desktop branch, and all account navigation paths. The surrounding application keys its providers by identity, so the in-memory shelf draft cannot survive an identity replacement. No session protocol, contract, daemon state or authorization authority changed; no independent model review was required or claimed.

No full browser suite, clean gate, deployment, physical-phone or installed-host verification was run. Those are not claimed by these synthetic checks.

## Decisions for later review

- **Use the existing 700px phone-sheet breakpoint.** The alternative was the drawer's wider 800px breakpoint. Existing phone detail sheets already use 700px; this keeps tablet/desktop popovers unchanged.
- **Keep a feedback draft only in the mounted account shelf.** Back retains it as in the accepted prototype; Cancel clears it. Reload or leaving the mounted shelf loses it. Persistent browser storage would retain personal feedback unnecessarily.
- **Forward does not resurrect a dismissed sheet.** Back entries describe transient open layers, not saved views. The alternative was replaying the menu on Forward; dismissed controls remain dismissed instead.

## Live check

After deployment, on a phone:

1. Open the drawer and press the account row. The full-width sheet sits above the open drawer; quick choices do not dismiss it.
2. Open feedback, enter a short draft, then use Takaisin or the browser's Back gesture. The menu returns. Reopen feedback: the draft is still there. Cancel clears it.
3. Dismiss the menu by tapping above it, swiping its head downward, or Back. The drawer remains open and usable.
4. Open Settings, including the sound row's night-settings shortcut. Back returns to the original page, not an extra menu entry.
5. Check desktop once: its account menu remains an anchored popover.

Status stays `testing` for this live check.
