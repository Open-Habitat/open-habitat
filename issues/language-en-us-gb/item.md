---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: open
priority: normal
lane: language-en-us-gb
lane_seq: 1
related: ['@ui-language-choice']
preparation: ready
---

# Language: English (US) and English (UK) as separate choices

Jari 31.10.: the language choice should distinguish en-US and en-GB. Today the choices are Järjestelmä · Suomi · English (`ui-language-choice`), per person in account preferences with a server default. Add en-US and en-GB as separate choices both for the person and for the server default; *Järjestelmä* maps the browser's `en-GB`/`en-US` (and other `en-*`) sensibly. The difference is spelling in the catalogs and date, time and number formatting through `Intl` with the chosen locale. Keep one English catalog plus a small en-GB overlay of only the strings that differ, rather than a duplicate catalog. Contract (`account-preferences`, `site-language`) and Fleetrepo's `ui.default_language` accept the new values; decide whether the plain `en` value stays as an alias and record it under Decisions for later review.
