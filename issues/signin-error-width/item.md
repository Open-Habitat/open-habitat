---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: signin-fix
lane_seq: 2
collision: [web/]
---

# Sign-in error notice is wider than the login card

_Source: chat_

Jari, 2026-10-12, first sign-in on pilot.20 (desktop Brave, wide window): the red "Kirjautumisessa tapahtui virhe" notice under the login card spans the full window width, while the login card above it has dialog width. The notice belongs to the card and should share its width and alignment (`web/src/app/App.tsx` renders it when `auth_error` is in the URL; `web/src/components/LoginCard.tsx`). Check the phone width too.
