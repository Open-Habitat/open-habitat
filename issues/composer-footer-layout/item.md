---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: open
priority: high
related: ['@pilot14-session-revalidation-loop']
---

# Lähetä-painike ja Enter-vihje eivät ole samalla rivillä, tyhjää tilaa viestikentän ympärillä

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

- "Lähetä"-painike on oikealla ylempänä ja "Enter lähettää · Shift+Enter rivinvaihto" -teksti selvästi sen alapuolella vasemmalla. Niiden pitäisi olla samalla rivillä; nykyinen asettelu vie ylimääräistä tilaa.
- "Vuoro valmis 20.40 · odottaa viestiäsi" -rivin yläpuolella on ihmeellisen paljon tyhjää.

Kuva liitteenä. Komponentti `web/src/components/Conversation.tsx` (composer-alue). Katso myös @review-browser-design-v2, johon viivaleveyksien, paddingien ja fonttikokojen tarkistus design-malleja vasten kirjattiin.
