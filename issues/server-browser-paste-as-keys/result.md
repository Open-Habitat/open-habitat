# Clipboard-free shortcut paste

Ctrl/Cmd+V on the picture uses the existing X-keystroke path. The entire
value is checked before any text is sent. Unsupported characters (including
emoji/CJK), more than 1,000 characters, line breaks and control characters
warn without typing a prefix or putting the value on the remote clipboard.
The popover's explicit **Liitä sivulle / Paste into page** remains the
separate clipboard route.

The useful UI pieces were harvested from the preserved experiment: shortcut
handling while the agent controls, masked fields with eye toggles, warnings,
and returning focus to the picture after explicit keystroke sending. The
CDP insertion implementation was not adopted: no host, gateway, daemon,
mutation or contract change, and no insertion-route skill instructions.

## Assessment follow-through

All four practical findings in the earlier assessment are addressed:

- **F2, invalid text:** local whole-value validation gives a definite refusal,
  including form-feed and tab, before any dispatch.
- **F3, pre-dispatch failure:** the host insertion route and its ambiguous
  error mapping are absent. Disconnected input and refused takeover do not
  send text and are not reported as uncertain insertion.
- **F5, delayed takeover:** a connection epoch and exact client identity fence
  both takeover replay and shortcut continuation. Disconnect, replacement
  and unmount discard buffered input; a late grant cannot resume it.
- **F6, no paste event:** the fallback guidance tells an agent-controlled
  viewer to take control first. The timeout itself does not take control.

## Review

Focused self-review, as authorized for the UI-only version: traced trusted
paste capture, all refusal branches, modifier release, takeover and connection
lifetime, explicit clipboard use, focus return and eye controls. No session,
daemon-state, wire-contract or authorization-boundary implementation changes
remain. No independent model review is claimed for this harvest.

The native Ctrl+Shift+V case specifically checks that held Ctrl/Shift do not
turn the text into remote commands. Self-review also caught that releasing
those modifiers without restoring still-held keys would break the next shortcut;
the viewer now restores them, and native paste followed by Ctrl+A without
releasing Ctrl verifies that behavior. The rejection cases require a fresh warning
rather than accepting a leftover toast. Visual inspection found the draft's
absolutely positioned eye could extend below its input; a two-column field row
keeps both controls together. No unresolved finding was filed.

## Verification

Based on `3d7b9d27e`; final source is in this result's commit. All browser runs
were sequential, with disposable synthetic profiles, `umask 077`, a scratch
lease, a timeout and port base 16400.

- `./scripts/test-focused.sh --area web`: 252 files / 2,050 tests passed,
  including disconnected/replaced/unmounted delayed takeover and no-event
  fallback tests; formatting and TypeScript checks passed.
- Focused `server-browser.spec.ts`: passed; final Playwright
  `tests/server-browser.spec.ts --repeat-each 3`, two workers and 0–60 ms
  reply jitter: **33/33 passed**. Includes explicit clipboard preservation,
  atomic refusal, focus return, eye toggles, axe and Explain-mode interaction.
- Native focused keyboard spec: passed; final Playwright
  `tests/server-browser-keyboard-native.spec.ts --repeat-each 3`, one worker:
  **6/6 passed**. Real Xvnc/Chromium receives ä/ö/€ by Cmd+V and Ctrl+Shift+V,
  Shift+Insert does not duplicate the value, emoji and multiline input show
  new warnings without sending a prefix. Ordinary, password and editable
  fields plus the existing supported-repertoire/Caps-Lock checks pass.
- Finnish and English Explain cards inspected in synthetic captures at 1440
  and 390 CSS pixels; eye mapping, masking and card fit agree with the actions.
  UK uses the same card text.
- UI references regenerated; generator check passed before unrelated existing
  Explain/Terminal reference drift was restored to the base version. The five
  changed browser references match their sources.
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`: passed.

No Go code was kept, so no Go package run was required. Contract files are
unchanged. No whole browser suite or clean gate was run. Initial setup lacked
the Pi fixture dependency; it was installed before the successful browser runs.
A test refinement initially installed the fake clock after the old toast timer
already existed; moving clock installation before navigation fixed that test
setup, and both final repeated suites passed.

Evidence (logs and paired synthetic HTML/PNG captures) is outside git under
`/var/tmp/agent-keep/paste-x-47jbwwvsxb/`. The native lab uses a sandbox-disabled
Chromium wrapper only in disposable profiles. This is not installed-server,
distinct-UID, physical Mac, Safari/Firefox or sandbox qualification. No deployment
or push was performed.

## Decisions for later review

1. Refuse every shortcut newline, including in a textarea: the X path cannot
   know whether Enter submits. Alternative: infer the field; rejected because
   that would reintroduce destination guessing.
2. Refuse tabs as control characters, rather than send Tab and move into another
   field. Explicit clipboard paste remains available.
3. Keep the existing 1,000-character bound and leave the popover open after
   explicit keystroke sending, but focus the picture. No silent clipboard
   fallback or automatic replay after a connection replacement.

## Live check

After deployment, focus a synthetic page's input and paste `äö€ test` with
Cmd/Ctrl+V. It should arrive directly without opening the popover. Paste an
emoji, multiline text and a value over 1,000 characters: each should warn and
leave the input unchanged. Use the explicit popover paste only when deliberately
choosing the clipboard route. Send a value with **Kirjoita näppäilyinä**, then
press Backspace, Enter and Tab: they should reach the page. Check both eye
buttons and their Explain cards. On a browser that supplies no paste event,
check that the fallback tells you to take control before sending.
