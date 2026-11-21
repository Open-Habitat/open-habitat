# Terminal settings withdrawn; automatic copying removed

Jari's 2026-11-21 decision is implemented: no terminal settings view, no copy-on-select feature. The proposed settings view existed only in prototypes, not production routes. Both prototype rounds and their check scripts are retired to Git history:

- `design-system/prototypes/rounds/2026-11-21-terminal-settings/`
- `design-system/prototypes/rounds/2026-11-21-terminal-settings-2/`

The experimental catalog/card, settings search entries, translations, feature reader and automatic clipboard writes are removed. Saved `terminal-copy-on-select` values remain readable but have no effect. Ctrl+Shift+C, macOS Cmd+C, browser copy events and the selection's Copy button remain explicit copying paths. The UI reference was regenerated from current sources; this also refreshes previously stale generated descriptions without changing their source behavior.

## Review

Focused self-review, as authorized: traced canvas selection, tmux OSC 52 selection, mouse-release listener cleanup, explicit clipboard actions, catalog consumers and stale preferences. No session lifecycle, contract, daemon state or authorization boundary changes. The change removes behavior rather than adding an authority. No independent model review needed.

The former automatic-copy browser case now verifies that an enabled retired switch cannot cause canvas or tmux selection to write the clipboard, then verifies the shortcut and Copy button. Experimental preference synchronization tests use a remaining feature. Prototype checks only exercised the rejected settings designs and were removed with them; production selection, clipboard, settings and accessibility checks remain.

## Verification

Base: `7b6b8d3803a03220c0741a869b1117e395038213`, with this change applied. Commands used `umask 077`, scratch leases, timeouts, and browser workers limited to 2.

- `./scripts/test-focused.sh --area web`: passed (241 files, 1,953 tests, plus static checks). An initial formatting failure was fixed before the successful run.
- `./scripts/test-focused.sh --area browser --spec browser-terminal.spec.ts --spec browser-shell.spec.ts --spec settings-experimental.spec.ts`: 20 passed, one unrelated long-draft layout case failed. Initial missing Pi SDK fixture dependency was installed before running.
- All changed specs: `npx playwright test tests/browser-terminal.spec.ts tests/settings-experimental.spec.ts --repeat-each 3`, with `OH_REPLY_DELAY_MS=60`: 27 passed. Includes the experimental settings accessibility audit.
- Relevant existing shell clipboard/paste/composer case: `npx playwright test tests/browser-shell.spec.ts --grep 'multi-line paste asks first' --repeat-each 3`: 3 passed, including refused and unavailable clipboard behavior.
- `./scripts/test-focused.sh --area go --go-package ./internal/experimental`: compiled successfully; package has no tests.
- The additional unchanged long-draft case also failed on unchanged main at the base revision with `./scripts/test-focused.sh --area browser --spec browser-shell.spec.ts --tag 'a long draft scrolls'`. Filed unlaned as `@browser-shell-long-draft-layout-check`; not chased as part of this removal.
- `python3 scripts/generate-ui-reference.py --check`, `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check`: passed.

Evidence logs: `/var/tmp/agent-keep/remove-copy-on-select-{web,browser,repeat,shell,go,main-baseline}.log`. These are synthetic host-backed checks, not live deployment or distinct-UID evidence. No full browser suite, clean gate, deployment or live check was requested or performed.

## Decisions for later review

- Close the settings proposal as obsolete, rather than delivered: the proposed page was explicitly withdrawn. The accompanying automatic-copy removal is delivered in the same commit.
- Leave old saved values untouched rather than migrate/delete personal preferences: removing every reader makes them harmless, and browser coverage proves normal use and subsequent settings writes still work.

## Live check

After deployment, put a recognizable value on the clipboard. Select terminal output with Shift-drag and ordinary tmux drag: neither should replace it. Press Ctrl+Shift+C or the selection's Copy button: the selected text should now be copied. On macOS, also try Cmd+C. There should be no automatic-copy experiment or terminal settings page.
