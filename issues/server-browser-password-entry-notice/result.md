# Result

Clipboard now leads with a separate, always-masked password field and a primary
**Kirjoita näppäilyinä / Type as keystrokes** action. Ordinary text retains paste,
keystrokes and the existing hide toggle; that toggle cannot reveal the password.
The short Finnish/English notice says the entered password reaches the page and
is not hidden from the agent, and keeps the password manager on the person's
own device. The agent skill directs password entry to the viewer, never chat.

The password field clears after sending, loss of control, disconnect or viewer
unmount. Unsupported characters are refused before any keys are sent and remain
masked for correction. This is input hygiene, not isolation or secure memory
erasure. No session, wire contract, daemon state or authority was changed.

## Decisions for later review

- Use a separate single-line password input before ordinary text rather than a
  revealable shared field or a mode toggle: it makes the password route visible
  without allowing the ordinary-text reveal toggle to expose its value.
- Preserve ordinary-text keystrokes and their Enter confirmation, rather than
  remove existing functionality. The password field cannot contain line breaks.
- Clear the password on disconnect; retain rejected input while connected so
  unsupported characters can be corrected without showing the credential.

## Checks and review

Focused self-review was proportionate to this UI and skill-text change: traced
password state, noVNC send/refusal paths, clear paths, non-echoing feedback,
ordinary-text preservation, bilingual wording and Explain-mode action blocking.
No independent model review was required: no session, contract, daemon-state or
authorization boundary changed.

Final checks on this change (the commit carrying this result identifies the tree):

- `./scripts/test-focused.sh --area web`: 248 files, 2,023 tests passed, including
  static/catalog/component checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser
  --spec server-browser.spec.ts`: 11 cases passed during development.
- Final `npx playwright test tests/server-browser.spec.ts --repeat-each 3` from
  `web/`, with two workers, port base 15400 and reply jitter 0–60 ms: **33 passed**.
  Used the direct focused Playwright invocation because the focused wrapper
  does not accept `--repeat-each`. Both commands had a timeout, umask 077 and
  scratch lease. No whole browser suite or clean gate ran.
- The extended clipboard case checks native password masking, non-ASCII keysyms,
  no remote clipboard write, clear-on-send, refusal without partial input,
  non-echoing toast and clear-on-control-return. Existing paste, Enter-confirmation
  and accessibility checks remain green.
- Four synthetic-lab cases check B09/B10 mapping and blocked sending in Explain
  mode at 1440 and 390 CSS pixels, in Finnish and US English. Screenshot review
  confirmed readable cards and a masked field. UK uses the same wording.
- `python3 scripts/generate-ui-reference.py --check`,
  `python3 scripts/validate-project-view.py`, `git diff --check`, and
  `issuectl doctor --json` passed. UI reference regeneration also caught up
  pre-existing browser and asset-date reference drift; production asset code
  was not changed.

Evidence: `/var/tmp/agent-keep/password-entry/` contains final `web.log`,
`repeat.log`, and paired `field-{1440,390}-{fi,en-US}.{png,html}` and
`send-{1440,390}-{fi,en-US}.{png,html}` synthetic captures. None is committed.
Initial setup failures (missing Pi SDK fixture, unsupported wrapper repeat flag)
were corrected. Capture setup was corrected to use the synthetic lab marker;
language preferences are written separately and the rendered language checked.

No Go source changed, so Go tests were not run. Native Xvnc/Chrome keyboard and
live-installation tests were not rerun: these tests prove viewer delivery to a
synthetic RFB peer, not new OS keyboard mapping or isolation. Deployment and the
live check below remain for the conductor, not prerequisites claimed complete.

## Live check

Open the server browser, take control, select the destination password field,
and open Clipboard. Paste one disposable test password into the upper masked
field and press **Kirjoita näppäilyinä**. It reaches the selected page field and
the local field empties. Confirm the exposure note is visible, ordinary text
still pastes separately, and the password field empties when control returns.
Repeat at phone width and in English. Keep the password manager on the local
device; do not test with a real vault or publish real credentials.
