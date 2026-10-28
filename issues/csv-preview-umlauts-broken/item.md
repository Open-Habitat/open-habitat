---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
lane: file-offers
lane_seq: 2
preparation: ready
provenance: chat
source_ref: kokeiltavaa:2026-10-28/csv-preview-umlauts-broken
closed: 2026-10-28
---

# CSV preview shows Finnish letters broken

CSV:n esikatselu näyttää ääkköset rikki (Jari 27.10., pilot.442): *Näytä taulukko* tiedostolle `viikon-luvut.csv` (UTF-8 ilman BOMia, puolipiste-erotin, ääkkösiä otsikossa *päivä*) näyttää ä:n a:na (pisteet katoavat), vaikka ladattu tiedosto on omalla koneella oikein. Tavut kulkevat siis oikein. Esikatselu lukee tiedoston `readOfferedFile`-funktiolla (`web/src/app/fileOffers.ts`) ja purkaa sen tiukasti UTF-8:na (`utf8`, `web/src/app/attachments.ts`), minkä pitäisi joko onnistua tai antaa ilmoitus *ei ole UTF-8-tekstiä*. Tiedostopaneelissa sama ä näkyy oikein (`kesä/`), joten ä→a syntyy taulukon piirrossa: `tableRows` tai taulukon fontti (`agent-file-offer`).
