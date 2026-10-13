# Result

The flash was the `ArchiveControls` unknown-state `InlineNotice` rendered while the new session existed but its archive fact had not reached the snapshot. The control now renders the same icon from first paint with an explicit loading reason, without the oversized notice; a confirmed unknown archive state still retains its warning. The slowed-snapshot browser test checks the loading interval. No host state is inferred.

Paired synthetic-lab icon-row captures and offline HTML are `lab-{light,dark}-{1440,390}.{png,html}`. Unlike the draft, retitle is disabled for an empty conversation and archive remains disabled until its fact is confirmed. The screenshot shows settled state; the slowed first-paint interval is captured by the browser test rather than a screenshot. Visual approval remains after release.

Validation: `./scripts/test-focused.sh --area web` passed (111 unit, 97 component); `OH_PORT_BASE=14600 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts` passed 64/64, including a delayed snapshot during opening; `shell-accessibility.spec.ts` passed 3/3. The actual test-server transient frame was not captured; this reproduces its source condition synthetically.
