# Result

*Kerro agentille* now sends at once through the conversation's own send path
and closes the note; × closes it without sending. A told or closed note is
removed from the editor channel's list for good, and note ids are no longer
derived from the list, so a removed note cannot come back under a reused id.

Sending follows what the composer's send button would do at that moment:
during a turn it uses the selected working mode (Ohjaa / Työn jälkeen), when
Pi is not running the message is held and starts Pi, otherwise it is sent
directly. When the composer could not send (stale status, uncertain previous
send, archive, server gone…) the button is disabled with the composer's own
reason as its tooltip, and the note stays. The person's draft is left alone;
the held-message path got a `keepDraft` flag for that.

Message: "Tallensin tiedoston <path> ja korvasin samalla muutoksesi. Lue
tiedosto uudelleen ennen kuin jatkat."

Checks: `test-focused.sh --area web` (lint, types, unit), the concurrent-edit
browser spec at 1366 and 390, the whole browser suite (350 passed, 3 skipped).
The web unit run reports one unhandled jsdom error from the untouched
`CodeMirrorEditor.test.tsx`; it also happens on main and is filed as
`utterly-damaging-balls`.
The full gate (`ci-local.sh --clean`) failed only in web-checks, on that
error and on the load flake in the untouched `StartHere.test.tsx`
(`start-here-test-lazy-markdown-flake`); Go, contracts and Storybook passed.
No receipt was written.

## Decisions for later review

- The message drops the list of replaced lines; the agent rereads the file.
- The note closes as soon as the send starts, without a confirmation. The
  conversation's ordinary receipt shows the send's fate; a rejected message
  is put back into an empty composer by the existing send path.
- The recap card is dismissed on this send as on any other send.
