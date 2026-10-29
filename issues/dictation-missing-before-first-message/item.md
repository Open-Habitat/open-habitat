---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
lane_seq: 2
collision: [web/src/app/PendingConversation.tsx]
preparation: ready
closed: 2026-10-29
---

# Dictation button missing before the conversation's first message

_Source: chat_

## Description

Jari 29.10.: sanelupainike ei näy kirjoituskentässä ennen kuin keskustelu on
alkanut (uuden keskustelun aloitusnäkymä, ennen ensimmäistä viestiä). Se näkyy
vasta, kun keskustelu on olemassa. Sanelun pitää olla käytettävissä
molemmissa tiloissa.

Syy koodissa: `Composer` näyttää `DictationControl`in vain, kun sille annetaan
`speech` (`web/src/components/composer/Composer.tsx`), ja ainoa kutsuja, joka
antaa sen, on `web/src/app/BrowserConversation.tsx`. Aloitusnäkymän composer
(`web/src/app/PendingConversation.tsx` / `StartPageRead.tsx` -polku) ei anna.

## Acceptance Criteria

- [x] Sanelupainike näkyy ja toimii uuden keskustelun aloitusnäkymässä samoin kuin käynnissä olevassa keskustelussa, myös worktree-agentin ensimmäisen viestin näkymässä.
- [x] Sanelun teksti päätyy samaan luonnokseen kuin tavoitteen Aloita-teksti eikä katoa, kun keskustelu luodaan ensimmäisestä viestistä.
- [x] Selainspeksi aloitusnäkymän sanelulle (fake Soniox).
