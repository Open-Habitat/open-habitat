# Result

## Cause

A product defect, which the spec's timing exposed.

The spec's `reply()` pressed Lähetä and navigated away at once. The send
request could then be aborted before the host answered, so the tab
recorded the send's outcome as unknown. Opening the conversation again
gave that text back into the field (`useSentMessages`, the restore
branch). The spec then filled its next message over it.

The status read soon proved the earlier send accepted after all. The
"given back as unknown, then shown accepted" branch clears the field when
it still holds exactly the given-back text. It compared against `draft`
as captured by the effect, which is the draft of the render the effect
was committed with. Typing that had not rendered yet, Playwright's
`fill` here or a fast person, was not in it. So the field held the
person's new text, the effect saw the old one, and it cleared the field.
The new message was lost, and Lähetä stayed disabled because the field
was empty. Diagnostic logging in a failing run showed the order: restore
`second`, change to `third`, clear on accepted, change to `""`.

A real person meets the same thing when they reopen a conversation whose
send was lost and start typing before the outcome settles.

## Decisions

- `useSentMessages` takes `draftNow()`, the field as it is now
  (sessionStorage, written synchronously by `changeDraft`), and uses it
  in all three outcome branches: accepted, pending again, and given
  back. `BrowserConversation` already read the field this way for the
  lost-send resend; that getter now sits before `useSentMessages` and is
  passed in.
- The spec waits for the host's answer to `POST …/send` before leaving
  the page. The case is about turns finishing elsewhere, not about lost
  sends. The unit test in `sentMessages.test.ts` covers the defect
  directly and fails without the fix.

## Verification

- `sentMessages.test.ts`: the new case fails without the fix and passes
  with it.
- `./scripts/test-focused.sh --area web` green.
- `rail-turn-returns.spec.ts` green 10 times in a row with
  `OH_BROWSER_WORKERS=2`.
