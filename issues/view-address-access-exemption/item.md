---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: done
priority: normal
lane: view-address-access-exemption
lane_seq: 1
related: ['@view-address-entry-route']
preparation: ready
closed: 2026-11-01
---

# Public view addresses open past the site's own access pin

Jari 1.11. (security boundary, decided): a public view link opens for anyone who can reach the server; only network reachability limits it. Habitat's own access pin (`oauth.access`) must not keep public links closed. Exempt from the pin exactly the anonymous reads a public link needs: GET/HEAD of `/n/<entry>` on the app origin and of the public content on the view hosts, and nothing else (no API, no private entry, no owner frame, no other path); a private or unknown address still answers like today and reveals nothing. Ingress-level policy (Cloudflare Access, tailnet-only) stays the operator's choice: update `docs/operations.md` to say the pin no longer applies to public links and that an ingress policy still does. Update ADR 0035's sentence accordingly. Tests: anonymous request with the pin on reaches public content and nothing else.
