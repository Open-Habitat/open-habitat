---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: open
priority: normal
lane: integration-scopes
lane_seq: 4
blocked_by: ['@integration-grant-capabilities']
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/integration-account-level-microsoft-dropbox
---

# Integrations: choose the account level for Microsoft 365 and Dropbox

Vaihe 2/3. Tilitason valinta yhdistettäessä ja Vaihda taso -toiminto Microsoftille (Täysi / Luonnokset ei lähetystä / Vain luku; sovellus tasoa kohden integrations.json:ssa ja brokerin Valid-säännössä; puuttuva sovellus näkyy harmaana kortti ja ohjaa ylläpitäjälle) ja Dropboxille (Täysi / Sovelluskansio / Vain luku), yksisuuntainen peili vain luku -tiedostoille viimeisen kaksisuuntaisen synkronoinnin jälkeen, vanhan kirjautumisen peruminen tason vaihdossa Dropboxilla. Valittujen kansioiden Microsoft-taso voi jäädä pois. Speksi: issues/proto-integration-permission-levels/ (prototyyppi, NOTES.md ja result.md; Jarin valinta 2026-10-28 suunta 1 Tilitaso) ja issues/research-integration-permission-scopes/result.md. Host-faktat ja niiden nykytila ovat result.md:n taulukossa; mikään vaihe ei siirrä valtaa gatewayn, daemonin ja provisionin välillä eikä tuo uutta tallennetta: taso luetaan aina myönnöstä.
