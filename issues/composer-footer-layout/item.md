---
created: 2026-10-01
updated: 2026-10-04
type: bug
reporter: Jari
status: fixed
priority: high
related: ['@pilot14-session-revalidation-loop', '@migrate-bespoke-controls']
blocked_by: ['@migrate-bespoke-controls']
lane: ui-foundation
lane_seq: 21
closed: 2026-10-04
closed_by: claude
---

# Lähetä-painike ja Enter-vihje eivät ole samalla rivillä, tyhjää tilaa viestikentän ympärillä

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

- "Lähetä"-painike on oikealla ylempänä ja "Enter lähettää · Shift+Enter rivinvaihto" -teksti selvästi sen alapuolella vasemmalla. Niiden pitäisi olla samalla rivillä; nykyinen asettelu vie ylimääräistä tilaa.
- "Vuoro valmis 20.40 · odottaa viestiäsi" -rivin yläpuolella on ihmeellisen paljon tyhjää.

Kuva liitteenä. Komponentti `web/src/components/Conversation.tsx` (composer-alue). Katso myös @review-browser-design-v2, johon viivaleveyksien, paddingien ja fonttikokojen tarkistus design-malleja vasten kirjattiin.

## Comments

### 2026-10-02T10:09:29Z · @jari

Additional live observation, 2026-10-02 13:04 ([cropped screenshot](attachments/composer-footer-2026-10-02.avif)): The completed-turn line "Vuoro valmis 06.07 · odottaa viestiäsi" has large empty bands above and below. The "Tapahtumia jäi väliin" notice has conspicuous unused space below its text and wide gaps both above and below the box. The left edge of that notice and the "Viesti Pi:lle" composer do not align. The disabled "Lähetä" button has excessive vertical space around it; the "Enter lähettää · Shift+Enter rivinvaihto" hint sits on a lower row, not aligned horizontally with the button (button bottom is above the hint top). Please investigate shared spacing/containers and composer layout, rather than treating each gap as an isolated margin fix. The crop contains only generic UI labels and a time; the attached AVIF has no image metadata.

## Resolution

### 2026-10-04T01:14:58Z · @claude

Resolved by @migrate-bespoke-controls: shared composer and floating jump geometry, synthetic 390×844 and 312×675 viewport checks, and reviewed spacing corrections. Original live viewport/zoom were not recorded; appearance still awaits Jari's review.
