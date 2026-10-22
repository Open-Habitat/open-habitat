---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: start-guide
lane_seq: 3
collision: [web/src/components/start-page]
---

# Start page: existing file ignored in 4dcube; hint too technical

## Description

Jari 2026-10-22 on 1362b57f, after `implement-start-page-guides`:
1. The empty-state hint "Luo repon .agents/start-page.md taidolla /skill:open-habitat-start-page." is too technical. Say it in the person's terms, e.g. "Luo aloitussivu kirjoittamalla /open-habitat-start-page" (or the form the composer actually accepts), without file paths.
2. In the 4dcube monorepo, which has a `.agents/start-page.md`, only that hint appeared: the start page did not work. Conversation: https://open-habitat-test.example.test/workspaces/ws_b-pbqqydbKsZ6orLcbDAvWck?conversation=pi:f139b3af-c486-4c0e-9b5c-f96418b17fe0 (user maintainer on the test VM). Likely the file is in the old format, which the new parser rejects without saying so, or the monorepo path/discovery differs. Find the actual cause. A file that exists but cannot be read must never look like "no file": show that the start page needs updating and how (in plain words), and log why.

## Acceptance Criteria

- [ ] Plain-language hint; existing-but-invalid file gives a clear "update the start page" state with the reason logged.
- [ ] The 4dcube case works after the fix (or after regenerating, if the file is genuinely old format), verified with a fixture reproducing its layout.
