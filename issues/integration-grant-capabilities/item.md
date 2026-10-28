---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: done
priority: normal
lane: integration-scopes
lane_seq: 3
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/integration-grant-capabilities
closed: 2026-10-28
---

# Integrations: read the actual grant and accept a narrower one

Vaihe 1/3. Daemon lukee myönnön palvelukohtaisiksi kyvyiksi (Googlen tokenivastauksen scope, Microsoftin scp, Dropboxin scopet) Service-riveille, hyväksyy kapeamman myönnön (organisaation tai suostumussivun rajaama) eikä hylkää koko kirjautumista, merkitsee puuttuvan palvelun, näyttää eron pyydettyyn (pyydettiin, ei myönnetty) ja Myönnetyt oikeudet -luettelon, johtaa ms-365-mcp-serverin --allowed-scopes myönnöstä, ja kertoo sivun yläosassa mitä taso ei estä. Speksi: issues/proto-integration-permission-levels/ (prototyyppi, NOTES.md ja result.md; Jarin valinta 2026-10-28 suunta 1 Tilitaso) ja issues/research-integration-permission-scopes/result.md. Host-faktat ja niiden nykytila ovat result.md:n taulukossa; mikään vaihe ei siirrä valtaa gatewayn, daemonin ja provisionin välillä eikä tuo uutta tallennetta: taso luetaan aina myönnöstä.
