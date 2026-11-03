---
created: 2026-11-03
updated: 2026-11-03
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m6fx4hmwph2jfsxa47yttekp/observed:lab-attach-filechooser-hang
originating_run: 01m6fx4hmwph2jfsxa47yttekp
originating_run_kind: spinoff
lane: attach-focus
lane_seq: 3
preparation: ready
closed: 2026-11-03
---

# lab-composer-area attachment picker spec sometimes gets no filechooser event

## Description

`web/tests/lab-composer-area.spec.ts:349` ("@lab attachment picker {1440,390} {light,dark}: direct selection and draft retention") sometimes hangs until the 30 s test timeout at `await cancelled` (the first `page.waitForEvent("filechooser")`, opened with Enter on the focused paperclip).

Observed 2026-11-03 on Birch under the ordering detector (`OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=r54-input`, 2 workers, lab config):

- main `a2758f9f`: 5 failures in 80 runs (`--repeat-each 5`, four batches).
- race-input-before-ready harvest branch: about 3 in 160, the same hang.

A passing run takes about 2.5 s. In failing runs an in-page probe showed that the paperclip had focus and was enabled, that keydown and keyup reached it, and that the hidden `<input type=file>` received its `click()`. Playwright still got no `filechooser` event. So the page asks for the chooser, and Chromium or Playwright never delivers it. Nothing on the product side stops it. Possible causes to check: transient user activation getting consumed before the `input.click()`, or the timing of filechooser interception against the key press. Without jitter it has not been seen.

Effect: an intermittent red in the lab suite under the detector, with no product effect shown. It blocks reading the detector's results for group 2 cleanly.

## Conductor 3.11.

The only red of the r56 clean gate (539/539 ordinary, 163/164 lab). Check first whether the paperclip opens the hidden input synchronously inside the key/click handler (a picker opened after an await, an effect or a state update loses the transient user activation; Safari then silently opens nothing). If so it is a product defect introduced with the direct picker (`a80f9220`).
