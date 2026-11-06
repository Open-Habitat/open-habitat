---
created: 2026-11-06
updated: 2026-11-06
type: bug
reporter: jari
status: fixed
priority: high
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/sharepoint-site-id-comma
lane: sharepoint-fix
lane_seq: 1
closed: 2026-11-06
---

# SharePoint libraries 404: site id commas escaped in the Graph URL (Contoso)

## Description

Jari 6.11.2026 (toisen agentin raportti Contosoin käyttöönotosta Ainon
kanssa): Ainon Microsoft 365 -tilillä SharePoint jäi tulematta, vaikka
kaikki tehtiin oikein. Outlook, kalenteri ja yhteystiedot toimivat
(tila ok, täysi taso), ja OneDrive tuli normaalisti.

- Oikeus myönnetty (`Sites.ReadWrite.All`), ja yhdistäminen löysi kaksi
  sivustoa, joita Aino seuraa (`/me/followedSites`).
- Kun daemon kysyi niiden dokumenttikirjastoja, Microsoft vastasi
  molemmista `404 itemNotFound`. Daemon ohitti molemmat sivustot
  (`skippedSites`), joten kansiovalinnassa ei ollut SharePointia.

Todennäköinen syy (varmistamatta): sivuston tunniste on muotoa
`contoso.sharepoint.com,<guid>,<guid>`, ja
`internal/daemon/integrations/microsoft_files_linux.go` rakentaa
`/sites/{id}/drives`-osoitteen `url.PathEscape(s.ID)`:llä, joka muuttaa
pilkut muotoon `%2C`. Microsoftin omissa esimerkeissä pilkut ovat
sellaisenaan. SharePoint-synkronointia ei ole aiemmin kokeiltu oikeaa
organisaatiota vastaan millään palvelimella.

Korjauksen jälkeen Aino tekee Microsoftin kansiovalinnan uudelleen.

## Acceptance Criteria

- [ ] syy varmistettu (Graphin dokumentaatio sivuston tunnisteen muodosta ja koodauksesta); sivuston kirjastot haetaan oikein muotoillulla osoitteella, ja epäkelpo tunniste hylätään eikä päädy osoitteeseen
- [ ] testi synteettistä Graphia vasten oikean muotoisella `host,guid,guid`-tunnisteella, joka kaatuu nykyisellä koodauksella; tarkista samalla muut Graph-osoitteet, joihin tunniste upotetaan
