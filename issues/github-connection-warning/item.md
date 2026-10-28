---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/github-connection-warning
lane: github-warning
lane_seq: 1
closed: 2026-10-28
---

# GitHub connection: visible host retry above the composer, then a warning; generic warning banner style

## Description

Toteuttaa Jarin valinnan 2026-10-28 issuesta proto-github-connection-warning (kierros 2, suunta 2 Näkyvä yritys kentän päällä; speksi: prototypes/github-connection-2, NOTES.md, result.md, toteutuksen osa 1 olemassa olevilla tiedoilla). Jarin muutos: vasemman laidan korostusraita pois, tilalle muun tyylin kanssa johdonmukainen tyylittely; tästä tulee meidän yleinen varoitusbannerin tyyli (design-systemin komponentti ja tokenit). Organisaation esto (403 tulkitaan nyt not_found) tunnistetaan, jos se onnistuu ilman daemonin uutta luokittelua; muuten osaan 2. Bugi typed-repo-unselectable-without-github voidaan korjata samalla.
