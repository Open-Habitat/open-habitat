---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: wontfix
priority: normal
lane: file-offers
lane_seq: 3
preparation: ready
provenance: chat
source_ref: kokeiltavaa:2026-10-28/download-asks-filename
closed: 2026-10-28
---

# Download button asks for a file name instead of downloading

*Lataa* kysyy tiedoston nimen (Jari 27.10., pilot.442), Jari toivoo latauksen alkavan suoraan. Painike on tavallinen `<a download=…>`, ja palvelin antaa `Content-Disposition: attachment` (`DownloadLink` `web/src/components/FileOffer.tsx`). Sivu ei pysty ohittamaan selaimen *Kysy tallennuspaikka* -asetusta, joten kysely tulee luultavasti siitä. Jarin mukaan selain ei kysy nimeä muilla sivustoilla (ei täysin varma), joten kysely voi tulla tuotteesta. Selvitettävä, millä selaimella ja millä vastauksen otsakkeilla. ZIP-lataus toimi oikein: kansiorakenne `kesä`, `talvi/tunturi` ja `LUEMINUT.txt` säilyi (`agent-file-offer`).

## Resolution

### 2026-10-28T05:46:43Z · @issuectl

Not a bug: Brave's default 'Ask where to save each file before downloading' (prefs::kPromptForDownload = true) asks on every site; Jari's Brave profile on maple keeps the default. The page and the gateway's headers ask nothing. See result.md.
