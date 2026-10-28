---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: done
priority: normal
lane: integration-scopes
lane_seq: 5
blocked_by: ['@integration-account-level-microsoft-dropbox']
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/integration-account-level-google
closed: 2026-10-28
---

# Integrations: choose the account level for Google

Vaihe 3/3. Tilitaso Googlelle (Täysi / Vain luku; luonnostaso harmaana, koska Google ei tarjoa sitä), tasokohtaiset scope-joukot, vanhan myönnön peruminen ennen uutta kirjautumista tason vaihdossa. Speksi: issues/proto-integration-permission-levels/ (prototyyppi, NOTES.md ja result.md; Jarin valinta 2026-10-28 suunta 1 Tilitaso) ja issues/research-integration-permission-scopes/result.md. Host-faktat ja niiden nykytila ovat result.md:n taulukossa; mikään vaihe ei siirrä valtaa gatewayn, daemonin ja provisionin välillä eikä tuo uutta tallennetta: taso luetaan aina myönnöstä.
