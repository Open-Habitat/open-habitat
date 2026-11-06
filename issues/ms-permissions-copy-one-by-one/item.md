---
created: 2026-11-06
updated: 2026-11-06
type: bug
reporter: jari
status: open
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/ms-permissions-copy
lane: setup-wizard-fixes
lane_seq: 2
blocked_by: ['@proto-m365-setup-flow']
---

# Microsoft setup: permissions copy as one list, but Entra's search takes one at a time

## Description

Jari 6.11.2026: Microsoft 365 -ohjatun asetuksen *Oikeudet*-vaiheessa
koko oikeuslistan voi kopioida yhdellä napilla (`microsoftPermissions`
yhdistettynä välilyönnein, `web/src/components/ServerIntegrations.tsx`),
mutta Entran *API permissions › Add a permission › Microsoft Graph ›
Delegated permissions* -hakukenttä hakee yhden oikeuden kerrallaan, joten
koko lista syötteenä ei toimi.

Korjaus: jokainen oikeus omalle rivilleen omalla kopiointinapillaan,
samaan tapaan kuin muut arvot (`Val`) ohjatussa asetuksessa jo ovat;
koko listan kopiointinappi pois Microsoftilta. Tarkista samalla Googlen
(Data Access › Manually add scopes ottaa pilkuin erotellun listan) ja
Dropboxin oikeusvaiheet: pidä koko listan kopio vain, jos konsoli
todella hyväksyy sen syötteenä, muuten sama rivikohtainen malli.

## Acceptance Criteria

- [ ] Microsoftin oikeudet kopioituvat yksitellen; Google ja Dropbox tarkistettu ja perusteltu result.md:ssä
