# Result

`gate-red-r69` made a cancelled archive question return focus to the
conversation's rail archive button, even after its row remounted. It
tried once, one frame after the dialog closed. The gate trace on fb2e18df9
showed the remounted button `disabled` at that moment. That happens while the
snapshot has no confirmed archive state yet or the turn is still settling.
`focus()` on a disabled button does nothing, so focus stayed on the page.

`useHelperArchiveConfirmation` now hands a cancel to `returnFocus`. It tries
on the next frame and then watches the DOM (rows and `disabled` changes)
for up to 10 s. Focus moves to the conversation's archive button as soon as
it is enabled. It still acts only while focus is on the page. It gives up when
the person clicks or presses a key, on a later cancel, and on a session
change.

## Evidence

On Birch, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15400`, umask 077:

- Unchanged product, `helper-archive.spec.ts`: 12/12 passed at
  `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250`, and 16/16 at throttle 6
  (`--timeout 120000`). With 6 CPU burners, 4 workers and throttle 4, 16/16
  passed. Throttle 6 with 4 workers at the default 30 s budget only produced
  unrelated timeouts. The natural race did not recur on this host.
- Deterministic probe (an uncommitted copy of the spec): it holds the archive
  button's `disabled` attribute for 500 ms across the Escape. Unchanged
  product: 4/4 failed at `toBeFocused`, the same assertion and symptom as the
  gate. With the fix: 8/8 passed under throttle 4 plus 250 ms reply delay.
- With the fix, `helper-archive.spec.ts --repeat-each 20` passed 20/20 at
  throttle 4 and 20/20 at throttle 6 (250 ms reply delay, `--timeout 120000`).
- Unit test `a cancel waits for the remounted button to become enabled before
  focusing it` fails without the fix. `a person who moves on keeps focus
  where they put it` guards the give-up. `test-focused.sh --area web`
  passes.

## Decisions for later review

- Wait for the button rather than moving focus to an always-enabled target
  such as the conversation's rail link. Alternative: focus the link and leave
  the button alone. The person pressed the archive button, so returning there
  is what they expect, and the wait is short in practice.
- The wait is bounded at 10 s. If the button stays disabled longer (a turn
  really running), focus stays on the page as before, rather than moving
  later without warning. Alternative: wait indefinitely until any input.
- Any pointer press or key press cancels the pending return, even one that
  leaves focus on the page, so the page never moves focus under someone who
  has started doing something else.

## Review

Focused self-review (web-only change; no daemon, contract, session state or
authority path).
