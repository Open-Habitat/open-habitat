---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: open
priority: normal
lane: integration-wizard
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/integration-wizard-merged-secrets-step
---

# Integration setup guides: console steps and secret fields side by side on one step, direct console links

Toteuttaa Jarin valinnan 2026-10-28 issuesta proto-google-wizard-secrets-step (speksi: sen prototyyppi, NOTES.md, result.md; suunta Rinnakkain): Googlen, Microsoft 365:n ja Dropboxin asetusohjeissa erillinen Tunnukset-vaihe poistuu ja tunnuskentät ovat konsolin ohjeen rinnalla samassa vaiheessa (Google 5→4, Microsoft 5→4, Dropbox 4→3). Jokaisessa vaiheessa on navigaatiopolun lisäksi suora linkki konsolin kyseiselle sivulle. web/src/components/ServerIntegrations.tsx.
