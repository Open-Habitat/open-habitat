# Result

## Cause

Steering was not the cause. Jari's native Pi session on Birch (claude-bridge
model, 2026-10-25 16:22 and 16:24) stores both mid-turn messages with the
`![name](/api/v1/attachments/<id>)` reference, the `Attachment path:` line
and the image block. The daemon's steer path and the history mapping kept the
attachment, and the browser parsed it into chips.

The chips were lost in the browser's `UserMessage` bubble. They were rendered
inside `.ah-user-content.ah-user-collapsed`, the box that clips a long message
to eight lines (`overflow: hidden`). On a message long enough to collapse, the
thumbnail therefore sat below the cut. The screenshot shows exactly that: the
first message collapsed with *Näytä koko viesti* and no thumbnail. A clipped
`loading="lazy"` image also never loads. Both of Jari's messages happened to be
long, and both happened to be steered, which is why the two looked related.
The same bug hits an idle message of the same length, in Pi and Claude
conversations alike, both live and after reload: every native user entry goes
through `UserMessage`.

## Fix

`web/src/components/Conversation.tsx`: the chips are rendered after the
collapsible text box instead of inside it. A collapsed message now shows its
attachments below the clipped text and above the expand button. The queued
`WaitingMessage` bubble never collapses and is unchanged.

## Evidence

- `web/tests/attachments.spec.ts`: the existing long-message case now carries
  an image attachment. At 1280 and 390 px in both themes, with the message
  collapsed, a hit test at the centre of the attachment's open button must land
  on that button and not on whatever lies over a clipped point. Before the fix
  it failed (`expected true, received false`); after the fix it passed. The
  spec's selectors no longer assume that the chips sit inside
  `.ah-user-content`.
- `./scripts/test-focused.sh --area web`: passed.
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: passed.

## Not tested

- Live on Birch or the test server with a real Claude-bridge steer (listed in
  `KOKEILTAVAA.md`).
- In a real Pi user message, the native image block also renders an
  "Kuva · image/png" row inside the collapsed box. It stays clipped with the
  text, which is acceptable because the chip already shows the attachment.
