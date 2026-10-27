---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-10-26/view-own-tab-subresources
lane: offers
collision: [internal/gateway/views_linux.go]
preparation: ready
closed: 2026-10-27
---

# Multi-file HTML view in its own tab loads no CSS or scripts

## Description

Testihavainto, kirjattu KOKEILTAVAA.md:stä 2026-10-27:

Moniosainen HTML-näkymä omalla välilehdellä ei lataa CSS:ää eikä skriptejä (0.0.0-pilot.422, 26.10., Mac): sama hakemistonäkymä toimii paneelissa, mutta *Avaa omalle välilehdelle* näyttää pelkän HTML:n ilman tyylejä, ja sivun skripti jää ajamatta. Yksittäinen HTML-tiedosto, jossa tyylit ja skripti ovat sisällä, toimii omalla välilehdellä. Arvaus: oman välilehden dokumentti on CSP-sandboxin vuoksi opaque origin, joten sen alipyynnöt ovat selaimelle cross-site, eikä `__Host-oh-view`-eväste (SameSite=None) kulje kolmannen osapuolen evästeitä estävässä selaimessa. Paneelissa ylin sivu on samaa sivustoa (example.test), joten eväste kulkee. Koodissa `internal/gateway/views_linux.go` (Jari).
