# Result

`agent browser click` now makes a real pointer click. The selector guard is
unchanged (exactly one match, not disabled). The page script then scrolls the
element into view (`block/inline: center`, instant), takes the centre of its
first client rect that lies inside the viewport, and hit-tests that point
with `elementFromPoint`. The CLI then sends `Input.dispatchMouseEvent`
mouseMoved, mousePressed and mouseReleased (left button, clickCount 1) at
that point through the browser host, which already shows the person the
agent's pointer and presses. The result now includes `point: {x, y}`.
`Runtime.evaluate` no longer needs `userGesture`, because real input gives
user activation itself.

Refusals happen before any input is sent, with `browser_action_refused`:
`not_visible` when the element is hidden or has no box inside the viewport,
and `covered by <tag#id.class>` when something else would receive the press.

The native fixture (`TestBrowserActionsNative`, `OH_BROWSER_ACTION_CHROME`)
gained a synthetic combobox below the fold whose options select on
pointerdown and cancel mousedown, plus covered, `display:none` and empty
targets. Before the fix the option saw only `click` and the field stayed
empty. After it, the option sees pointerdown, mousedown, pointerup, mouseup
and click. Note: cancelling pointerdown suppresses the compatibility mouse
events (Pointer Events spec), so the fixture cancels only mousedown, as React
selects do.

Checks (umask 077): `OH_BROWSER_ACTION_CHROME=/usr/bin/google-chrome
./scripts/test-focused.sh --area go --go-package ./internal/cli` and
`./scripts/test-focused.sh --area go --go-package ./internal/daemon` pass;
gofmt and go vet are clean.

Help text, the browser skill and TESTING.md now describe what click does.
