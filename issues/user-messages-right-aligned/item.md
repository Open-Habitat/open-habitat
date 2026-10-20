---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: done
priority: normal
lane: conversation
lane_seq: 1
collision: [web/src/components/conversation-thread]
closed: 2026-10-20
---

# Right-align the person's own messages in the conversation

_Source: chat:proto-decision-2026-10-20_

## Description

Jari 2026-10-20: in the prototype the person's messages are right-aligned, on the test server left-aligned. Right alignment is clearer and is how chats always work; change production accordingly (user bubbles right, agent content left), desktop and phone, light and dark, without breaking long messages, code blocks, attachments thumbnails or 'Näytä koko viesti'.

## Acceptance Criteria

- [x] User bubbles align right and agent replies remain left on desktop/phone in light/dark.
- [x] Long text/code, expand/collapse and persisted attachment thumbnails remain usable.
- [x] Focused web and affected browser checks pass.

## Implementation result

Preserved implementation from `feec2783`, cherry-picked as `9c51df44`
onto base `8154670f`. User rows align bubbles right in reading and ordinary
views, without changing the header or assistant inset. The attachment journey
checks geometry, overflow, expanded long literal code and thumbnails at 1280px
and 390px in both themes.

Validation also exposed a phone model-pill wrap and an outdated keyboard test:
phone toolbar labels now collapse to their still-labelled icons when the model
picker is present, and the test checks all three preceding controls. Renewed
focused self-review covers these additional changes; presentation-only CSS/tests
have no Unix-user, authority, authentication or installation changes, so an
independent security review is not warranted.

Final runnable bytes: `9c51df44` plus formatting correction in attachments,
phone toolbar CSS and model-picker keyboard-test corrections (the following
landing commit). Remote ARM host-backed synthetic checks, with TMPDIR=/var/tmp
and umask 077:

- `./scripts/test-focused.sh --area web`: PASS,
  job `27b5ffac9ff843b2d2ce343492ee7f1389eb0565ccf2b705f9ee6f514bcb8639`.
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: PASS,
  job `1f055543bbd57d7428613b1d775f6440c02f1388ded393d6c3fb9d765e7bc7a2`.
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`:
  PASS (all 67), job
  `a80c270407a75b88a0af7ae15a5576b42f898f1dbbee31b417b0af43b13b8551`.

Failure inventory: the prior worker hit formatting/lint errors (corrected),
an overly strict assistant inset assertion (corrected), and runner spool quota
(blocked final checks). This run's first web attempt found another formatting
error (`c8cf4762`); corrected. Web/attachments then passed, but conversation
found the model-pill height and tab-order failures (`04d0cbb6`), corrected as
above. A subsequent formatting failure (`831c288b`) was corrected. Final web
and attachments passed; conversation attempts `d7614394` and `38e0418f`
failed respectively on status-refresh visibility and rail keyboard navigation.
Both passed in the unchanged final full-spec rerun; these intermittent failures
are disclosed rather than counted as passes. Diagnostic path guesses (missing
CSS/artifact paths) and parsing a truncated log failed; corrected paths and raw
artifact/log inspection supplied the evidence. No required check remains failed.

Lab screenshot/HTML captures remain deferred under Alder policy; no local
fallback, full gate, live-server access, deployment or push. These checks do not
prove live-provider behavior, distinct UID isolation or native amd64 packaging.
No Fleetrepo installation change is needed.
