# Result

Fixed the spec's filechooser interception lifetime; no production change.

## Cause and review

The production chain is synchronous: `AttachmentMenu` passes `onAttach` to
`ControlButton.onPress`, forwarded directly to React Aria Button. The installed
React Aria `usePress` calls `triggerPressEndEvent` from its keyup or click handler,
which calls `onPress` directly. Composer's callback immediately calls
`picker.current?.click()`. There is no await, render, effect or scheduling hop.
The existing Composer picker test also asserts the click before any await.
The attachment focus handlers and upload completion are unchanged.

Playwright's `ChannelOwner._updateSubscription` sends `updateSubscription`
without awaiting it when the first filechooser listener is added, and disables
it when the last is removed. Previously the first waitForEvent installed that
subscription immediately before keyboard.press. The spec now keeps a listener
for the page lifetime, installed before navigation. Both individual waits still
precede their gestures and assert real chooser delivery; cancellation and file
selection still use the real input. This removes interception toggling around
both gestures without retries, sleeps, skipped assertions or product workarounds.
The page is disposed by the fixture, so the listener cannot cross cases.

Focused self-review covered the synchronous production chain, Playwright listener
ownership, unchanged focus behavior, and preservation of both chooser assertions.
No daemon, contract, session-state or authority code changed.

## Evidence

Birch, base `164a851b`, then that base plus the five-line spec change.
Dependencies installed from both lockfiles; umask 077 and disk-backed TMPDIR.
Each batch ran from `web/`, exactly the focused runner's lab command plus repeat:

```sh
OH_PORT_BASE=11600 OH_BROWSER_WORKERS=2 \
OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=r54-input \
npx playwright test --config playwright.lab.config.ts \
  tests/lab-composer-area.spec.ts --grep 'attachment picker' --repeat-each 5
```

- Before: four batches, **79/80 passed**, one original timeout at the first
  `waitForEvent("filechooser")` in batch 3 (390/light).
- After: four batches, **80/80 passed**, 28–30 seconds per batch.
- `./scripts/test-focused.sh --area web`: passed, 169 files / 1263 tests plus
  static checks.
- `./scripts/test-focused.sh --area browser --spec lab-composer-area.spec.ts`
  with the same detector environment: **10/10 passed**, including four picker
  accessibility cases.

These are host-backed synthetic Chromium results, not Safari/iOS or live-host
acceptance. The counts support the interception-race diagnosis; they do not
prove absence of every possible intermittent failure. No full gate was run.

## Decisions for later review

- Keep product code unchanged rather than replacing React Aria's press handling:
  the picker is already synchronous in the user's event, and changing it would
  risk keyboard/accessibility behavior without evidence of a product defect.
- Keep interception on from before navigation rather than adding a delay or
  Chromium-specific CDP command: a page-lifetime listener uses the public API,
  avoids repeated subscription changes, and preserves both real gestures.
