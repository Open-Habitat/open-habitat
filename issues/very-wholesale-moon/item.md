---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: full gate run in taskfleet worker
source_ref: taskfleet:01m5pya4800tm04czaycvjn3b3/gate-flake:browser-editor-lazy-compact-send
originating_run: 01m5pya4800tm04czaycvjn3b3
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Gate flake: browser-editor lazy compact chains times out on a disabled send button under load

## Description

`web/tests/browser-editor.spec.ts:497` ("@browser-editor @a11y lazy compact chains retry failed listings without scanning or replacing a dirty buffer") failed once in the full clean gate (`./scripts/ci-local.sh --clean --json`) on 2026-10-24, in run 01m5pya4800tm04czaycvjn3b3 on branch wt/zaycvjn3b3-seeded-route-walk. The browser phase ran on the Cedar warm slots with a load average of about 9.6.

Failure, in the spec's `openFile` helper (line 41), before the editor is reached:

    Error: locator.click: Test timeout of 30000ms exceeded.
      - waiting for getByTestId('send')
      - element was detached from the DOM, retrying
      - 52 × waiting for element to be visible, enabled and stable
         - element is not enabled

After `message-input` was filled, the composer's send button stayed `aria-disabled="true"` for 30 s. It looks as if the fill landed before a composer re-render that detached the button, so the new composer never saw the text, or the conversation was still not sendable under load.

The branch did not touch the composer, conversations or the editor. It changed the first-login route (gateway site read, daemon first-route mark, App first-load gate, GitHubOnboarding). The same spec passed in a whole-suite run of the same tree minutes earlier (362 passed), and 4 of 4 times with `--repeat-each 4` right after the gate. Its sibling `browser-conversation` title-dots flake is altogether-shocking-babies.

Likely fix: in `openFile`, wait until the send button is enabled after filling the input (or refill after a detach) before clicking, rather than relying on the click's actionability timeout.
