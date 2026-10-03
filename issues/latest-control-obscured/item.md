---
created: 2026-10-02
updated: 2026-10-03
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:11-14
related: ['@composer-footer-layout']
---

# Jump-to-latest control is obscured by the message composer

## Problem

Jari observed on 2 October 2026 that “Viimeisimpään” is partly hidden by the
message composer. The conversation also has excessive empty space around the
message area; a file-list tool block had a large gap before its first text line.
The live screenshots are private and are not attached.

## Intended result

The jump-to-latest control remains fully visible and usable above the composer,
including when the message input grows. Conversation content, status messages
and the composer form a consistent layout without unexplained empty bands.

Investigate the shared layout together with @composer-footer-layout, which
records related spacing and alignment observations and Jari's request to examine
shared containers rather than patch each margin separately. Find where the
reported space originates: the tool result itself, the message block or the feed
layout. These symptoms may have different causes.

The current jump control in `web/src/components/Conversation.tsx` uses
`.ah-jump-latest` in `components.css`: a zero-height sticky container, a negative
margin and an upward transform. This is a lead for investigation, not a confirmed
cause or a prescribed CSS fix. Demonstrate the resulting layout at the affected
viewport and zoom when known, and with a growing composer.

## Decisions

### 2026-10-03T05:40:49Z · @codex

Jari hyväksyi 3.10.2026 rajauksen: keskustelualueen yhteistä asettelua korjataan yhdessä composer-footer-layout-issuen kanssa. Hyppypainike näkyy ja toimii kokonaan myös kirjoituskentän kasvaessa; sisältö, tilaviestit ja kirjoituskenttä asettuvat yhtenäisesti ilman selittämättömiä tyhjiä kaistoja. Toteuttaja selvittää syyt. Nykyinen sticky-rakenne on tutkimusvihje, ei todennettu juurisyy, ja työkalulohkon sisäinen tyhjä tila voi olla eri ongelma.
