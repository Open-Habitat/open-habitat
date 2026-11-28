---
created: 2026-11-28
updated: 2026-11-28
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m8g5rh85gs4y8dcp93negyyw/review-finding:sha1:ca27e7d31ac5fd38693e5c606ceb1710988849ca
review_source: ai-review
originating_run: 01m8g5rh85gs4y8dcp93negyyw
originating_run_kind: spinoff
review_target: c323ebc50..HEAD (server browser agent command set)
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_severity: should-fix
review_confidence: high
labels:
- ai-review-model:claude-fable-5-2
- ai-review-model:gpt-6.1-sol
---

# Server browser: the revealed-password screenshot check misses cross-origin frames, closed shadow roots and replaced fields

## Description

## Problem

The server browser refuses an agent screenshot when a password field shows
its value in clear (`screenshotGuard`, `revealedPasswordScript` in
`internal/browserhost/pagescript_linux.go`). The agent can unmask a field
without script by clicking a site's own "show password" control, so this
guard is what keeps a typed password out of the picture. It decides from
what the page's main document can see, and misses these cases:

- A sign-in form inside a **cross-origin iframe** (embedded login or
  payment widgets): `contentDocument` is null, the guard treats the frame
  as having nothing to check, but the parent's screenshot shows its pixels.
- A field inside a **closed shadow root**: not visible to the walk.
- A reveal control that **replaces** the password input with a new text
  input carrying the value (instead of flipping `type`), when the field has
  no `current-password`/`new-password` autocomplete token: the host's record
  of password fields (`recordPasswordsScript`, taken before each agent press
  and when the person takes control) is by element identity.
- A password field that **appears during the person's turn** (for example
  after a username step) and that the person unmasks before giving control
  back, without an autocomplete token.

## Reproduce (synthetic)

Serve a page at origin A embedding an iframe from origin B with
`<input type=password>` and a button that sets `type='text'`. Take control,
type `synthetic-secret`, click the button, give control back, then run
`open-habitat agent browser screenshot --tab <id> --name x.png`: the
screenshot is saved and shows the value.

## Direction

Check each frame through the host's own sessions (iframe targets for
out-of-process frames, isolated worlds per frame for in-process ones), and
record fields per frame; or refuse when a frame cannot be checked, weighed
against how often captchas and widgets sit in cross-origin frames.

Found in the review of the change that removed agent JavaScript from the
server browser.
