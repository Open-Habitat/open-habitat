# Result

Mac Cmd+C now explicitly copies either the xterm selection or tmux's reported text. With neither, it consumes the shortcut without sending an interrupt. Shift+Cmd+C remains a browser action, and Cmd+V still reaches the paste event. Existing Ctrl copy/paste behavior is retained.

Finnish and English Explain hints use platform-specific copy and paste labels. Regenerated agent references include the extracted keyboard handler and platform-label source; discovery now recognizes xterm's custom handler registration.

## Evidence and review

- Focused self-review: checked modifier precedence, no-selection behavior, xterm selection precedence over reported text, clearing selection, browser default prevention, and generated-reference discovery.
- Focused web checks: 220 files, 1,732 tests passed, including Mac/non-Mac keyboard-handler tests; type checking and catalog checks passed.
- Focused `browser-terminal.spec.ts`: all four cases passed. Repeated the same spec three times: all 12 passed, with two workers and an isolated port base.
- The new browser case uses a Mac user agent and explicit Mac platform emulation on Linux Chromium, with a real synthetic-host terminal. It verifies copying both selection sources and preserving an unfinished shell command when Cmd+C has no selection. It is not a native macOS browser check.
- UI reference tests: all three passed; regeneration drift check and diff whitespace check passed.
- Explain text was reviewed in both languages in source; responsive rendered-card visual inspection was not performed. No layout or card mapping changed.

The copy-notices removal landed before this change. Rebased onto it, kept the removal in both Explain languages, regenerated references, and reran the focused web checks, four browser cases, and three reference tests successfully.

The first browser attempt stopped because the fresh worktree lacked the Pi SDK fixture; installing the pinned fixture dependencies resolved it. The first reference test run exposed a missing optional platform-source fixture; conditional discovery and a regression assertion resolved it.

## Decisions for later review

- Reused the existing platform detection from `altKey.ts`, rather than introducing user-agent parsing. This keeps keyboard behavior and labels consistent with existing platform hints.
- The non-Mac hint names Ctrl+Shift+C, which works for both xterm and tmux-reported selections; Ctrl+C retains its existing selected-text-or-interrupt behavior.

Live check: On a Mac, select terminal output and press Cmd+C, then paste into another field. Repeat after a plain tmux drag. With nothing selected, press Cmd+C while composing a shell command: the command should remain intact. Shift+Cmd+C should remain available to the browser; Explain mode should show ⌘C.
