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

# Palvelinintegraatiot: Apple row and one line on connecting from the person's list

## Description

Jari, 2026-10-24, on 0.0.0-pilot.390 (Apple, AI-avain and Käyttäjät ja pääsy work):

1. **Palvelinintegraatiot** needs one short line saying that the integrations offered here still have to be connected by each person from their own Integraatiot list (e.g. "Tarjolla olevat palvelut jokainen yhdistää itse omasta Integraatiot-listastaan."). One sentence, under the heading; Jari otherwise prefers no explanatory text.
2. **Apple (iCloud) is missing** from the Palvelinintegraatiot list. Add it in catalog order with its status (it needs no app credentials, so "Tarjolla" when its tools are present), and the Käyttöönotto badge when it is an onboarding step, consistent with the other rows.

## Acceptance Criteria

- [ ] Story, unit test and the server-integrations browser spec include the Apple row and the line.
- [ ] KOKEILTAVAA.md line.
