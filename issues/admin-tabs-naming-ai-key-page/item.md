---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/app/Settings]
---

# Server admin: rename to Palvelinintegraatiot, unambiguous status, own AI-avain page

## Description

Jari, 2026-10-24, testing the server administration on 0.0.0-pilot.387:

1. **Two tabs named "Integraatiot"** (the person's own and Palvelimen ylläpito's) is bad after all ("tämä kaksi saman nimistä välilehteä on nyt kyllä huono; toinen pitäisi nimetä jotenkin muuten"). Rename the administration tab **"Palvelinintegraatiot"** (his own phrase for it) and its page heading to match; update links (Käyttöönotto's badge links, guides, docs, tests).
2. **Status confusion:** on the administration tab Dropbox shows "Käytössä", and Jari read it as his personal Dropbox connection ("olen vain integroitunut henkilökohtaiseen Dropboxiini"). With the rename the context is clearer; additionally make the status unambiguous with the fewest words, e.g. "Käytössä" → "Henkilöiden käytössä" or a column header "Henkilöille" — pick the shortest wording that cannot be read as the administrator's own account, keep "Ei käytössä" counterpart consistent, and record it under "Decisions for later review".
3. **Site AI key gets its own page** in the server settings ("Tälle pitäisi olla oma sivu serverin asetuksissa"): move "Sivuston avain" out of Käyttöönotto's AI step into its own Palvelimen ylläpito tab (e.g. "AI-avain"), same behaviour (set/replace/delete with the replacement offer, suffix only, "joined people are not changed", "copies cannot be recalled"); Käyttöönotto's AI step keeps the offer choice and links to the new tab when the offer is `site_key`.

## Acceptance Criteria

- [ ] Stories, unit and browser specs updated; phone layout; no remaining "Integraatiot" label on the admin tab.
- [ ] KOKEILTAVAA.md lines.
