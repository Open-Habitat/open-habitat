---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/composer, web/src/components/Conversation]
---

# Composer: attachments as chips, not Markdown text; preview in an in-app dialog

## Description

Jari, 2026-10-24 (test server, screenshot): a pasted or attached image appears in the composer as Markdown text, `![CleanShot 2026-10-24 at 08.53.52@2x.png](/api/v1/attachments/6f82…)`, above which a thumbnail shows. "Olisiko mahdollista jotenkin välittää tieto agentille tästä screenshotista ilman että se tulee tollaisena tekstinä näkyviin tohon tekstikenttään." Clicking the thumbnail opens the file directly (a raw browser tab); "Musta sen pitäisi aueta sellaisessa omassa Open Habitatin dialogissa."

Goal: the person sees an attachment as an attachment (thumbnail / file chip with name and remove), never as Markdown in the text field, and the agent still receives the reference exactly as it does now when the message is sent. Clicking a thumbnail, in the composer or in a sent message, opens an in-app preview dialog (image at fit size, file name, close with Esc/outside click, download/open-original as a secondary action; non-image files show name, type and size). Mobile layout. Reuse existing dialog components and design-system tokens.

Code: `web/src/app/attachments.ts`, `web/src/components/composer/`, the sent-message rendering in `web/src/components/Conversation.tsx`. Earlier work: `composer-attachments` (closed).

## Acceptance Criteria

- [ ] Attaching or pasting a file adds a chip/thumbnail, the text field stays as the person typed it; removing the chip removes the reference; the sent message carries the same attachment reference to the agent as before (test).
- [ ] Thumbnail click opens the in-app dialog in composer and in sent messages; Esc and outside click close it; mobile layout (browser spec + story).
- [ ] KOKEILTAVAA.md line.
