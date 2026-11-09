# Result

The notice's `margin: 0` overrode the shared stream's horizontal margins.
Changed it to `margin-block: 0`, following restored-helpers-box-misaligned
(commit 1c28b6387). No mounting, interaction, or other layout change.

## Verification

Tested this branch's final CSS and spec changes on 2026-11-09:

- `./scripts/test-web-fast.sh`: passed.
- `OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser --spec context-ring.spec.ts --spec conversation-context-view.spec.ts`: both passed.
- The same specs with `OH_VISUAL_CAPTURE=1`: both passed; synthetic lab
  screenshots and static HTML are in `evidence/running-{1440,390}.*`.
- Regression experiment: restoring the old `margin: 0` made the browser's
  left-edge comparison fail by 182 pixels at 1440. Restored the fix and reran
  the fast checks and both browser specs successfully.
- `issuectl doctor --json` and `git diff --check`: passed.

The existing context-ring journey now compares the running notice's left edge
and width with the neighbouring assistant feed item at both viewport widths.
It disconnects the current stream and holds history/event reads while measuring,
then reconnects and verifies compaction completion. Thus slow measurements do
not race fake Pi's completion timer. Capture permits static asset reads; the
connection banner in the evidence is the deliberate observation hold.

Focused self-review checked the shared-margin cascade, both screenshots and
that only this notice's horizontal margin ownership changes. No external model
review or full clean gate was run; this is synthetic browser layout evidence,
not live Pi/provider or installed-host evidence. Initial capture attempts failed
on the lab marker and blocked asset fetches; the final capture run passed after
using the synthetic lab and holding only state-update reads.
