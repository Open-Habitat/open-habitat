---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: conversation-header
lane_seq: 2
collision: [web/src/components/conversation-header]
closed: 2026-10-23
---

# Model picker: remove clutter, fit without scrolling, close on outside click, real button

## Description

Jari 2026-10-23 10:45, model picker in a new conversation: too much content; it scrolls; everything should be visible at once. Remove:
- "API-avain laskutetaan käytön mukaan. Avoimet keskustelut jatkavat omallaan."
- the heading "Uusien keskustelujen tunnus" (odd wording; the provider choice can be a compact segmented control without that heading)
- the raw provider id `claude-bridge`
- "Merkit tulevat viimeaikaisista keskusteluistasi. Kokeilematon selviää ensimmäisessä viestissä. Agentin luettelo voi olla vanhentunut."
- per-model status badges ("Ei kokeiltu", "Vastasi 23.10. klo 10.43") and raw model ids under the names
- "Vain tähän keskusteluun. Oletus ei muutu." — replace with a small link "Muuta oletusmallia" to the settings where the default is changed.
Behaviour: the dialog must close on outside click and Esc (it stayed open over the conversation until "Valitse" was pressed). The "Valitse" button has the same background as the dialog until hover, so it looks like text: give it the standard primary button style.

Keep: provider choice, the current model list (most capable first), "Vanhemmat mallit" disclosure, thinking level.

## Acceptance Criteria

- [x] The picker fits without scrolling on a 1366×768 desktop and opens/closes with outside click and Esc; primary button styled; browser + a11y tests; screenshots desktop/390 px.
