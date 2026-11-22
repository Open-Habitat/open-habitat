# Account menu — A Groups

Implemented the accepted desktop direction: person header; Settings and administrator-only Server administration; Explain and Feedback about Habitat; Theme, Agent's work and (when enabled) Sounds; sign out last. Groups have accessible names and separators, not visible headings. Every action and quick row has a leading icon; Explain uses the top bar's question mark. The existing phone popover remains.

The feedback entry reuses `GeneralFeedback`, including its public-GitHub disclosure and existing payload construction. It opens above the account button and restores focus on close. Explain mode now lets that panel handle Escape even when opened through the account menu. No contract, session, daemon or authorization behavior changed; the administrator callback and sound experiment are unchanged.

## Verification

Tested implementation: `187c720e4` (tests ran against the identical code before committing).

- `./scripts/test-focused.sh --area web`: passed, 255 files / 2,143 tests, including static checks and catalog checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec lab-sidebar-account.spec.ts --spec lab-explain-follow.spec.ts`: 12 passed.
- Focused Playwright repeat of both lab specs with `--repeat-each 3`, two workers and `OH_REPLY_DELAY_MS=60`: 36 passed.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec account-settings.spec.ts`: 17 passed on the final code.
- `python3 scripts/generate-ui-reference.py` and `--check`: passed; generated differences follow only the changed sources.
- `git diff --check`, project-view validation and `issuectl doctor --json`: passed.

Checks ran under umask 077, bounded timeouts and the shared scratch lease. Early test failures exposed the Explain-mode Escape collision and two incorrect test assumptions; these were corrected before the passing final runs.

Browser coverage includes admin/non-admin menus; arrow-key order across groups; menu-to-feedback focus; Escape return; desktop and phone entry; Finnish and English Explain cards with touch exploration; unchanged top-bar feedback; and scoped axe checks on the account menu and feedback panel. Unit coverage checks action order, named groups and quick choices preceding sign out.

### Visual evidence

Paired synthetic PNG/HTML captures are retained outside git under `/var/tmp/agent-keep/account-menu-impl/`: `desktop-light`, `desktop-dark`, `phone-light`, `phone-dark`, `feedback-desktop`, `feedback-phone-light`, `feedback-phone-dark`, and `card-{fi-FI,en-US}-{1440,390}`. Inspected menu order/icons, the existing phone popover, feedback placement and both language cards. UK uses the same new copy. Final check logs are alongside the captures.

These are synthetic browser-host results, not installed-server or real GitHub submission evidence. No deployment or public issue submission was performed. The whole browser suite and clean gate were deliberately not run for this scoped change.

## Review

Focused self-review of the final diff, generated references and captured UI. This is presentation and local overlay state, with reuse of the existing feedback owner; no session, contract, daemon state or authorization boundary changes warrant an independent model review. Checked shared-menu behavior, focus ownership, screen-reader groups, icon decoration, unchanged administrator visibility, phone behavior and feedback payload reuse. No outstanding findings.

## Decisions for later review

- Place the existing feedback panel above the bottom account trigger, with the same panel body and interaction as its top-bar entry. Alternatives were placing it below (outside the viewport) or implementing a second modal/sheet. Reusing it above avoids both clipping and a second feedback implementation.
- Preserve the sound experiment and the existing phone navigation drawer when feedback opens. Alternatives were graduating Sounds or changing the phone overlay/navigation behavior; both exceed this desktop menu decision. The separate phone round still owns that design.

## Live check

After deployment, open the account menu with mouse and Enter. Check that Settings and Server administration are adjacent (the latter only for an administrator), Explain and Feedback form the next group, quick choices follow in their existing order, and sign out is last. There should be no visible group headings.

Arrow to Feedback and press Enter: the shared panel opens with its text field focused and explains that the GitHub issue is public and what is included. Escape returns focus to the account button. Repeat while Explain mode is active and from the phone's existing navigation popover. Check light and dark themes; enable Sounds to inspect its quick row. Cancel without submitting a real issue.
