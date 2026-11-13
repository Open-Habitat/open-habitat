---
created: 2026-11-13
updated: 2026-11-13
type: feature
status: open
priority: normal
preparation: ready
lane: website
lane_seq: 1
---

# Website: first version (Astro + Starlight, fi/en) in website/

## Goal

The first version of Open Habitat's public website, in this repository's
`website/` directory (`site/` is reserved for the schema), published on
GitHub Pages at `open-habitat.ai` once its preview has been approved.

## Agreed scope (Jari 13.11.2026)

- Astro and Starlight, the same skeleton as a sibling project's site: an npm
  project in `website/`, a `pages.yml` workflow, the custom domain from a
  `CNAME` file in `website/public/`.
- Finnish and English.
- A landing page: what Open Habitat is and for whom, how it differs from
  comparable tools, how to try it, its honest maturity and its security
  model. Then documentation under `docs/`.
- Text from the earlier one-page site draft and `docs/product.md`; look from
  the design system (`design-system/`: tokens, fonts, favicon).
- Screenshots and a preview for Jari before anything is published to the
  domain. The first version therefore lands with deployment switched off
  (manual dispatch only); turning it on is a separate step.
- DNS and Cloudflare (the canonical domain and three redirecting domains)
  are handled in the infrastructure repository after the preview, not here.

## Next action

Build the first version and its preview (agent's authority within the scope
above). Publishing waits for Jari's verdict on the preview.
