---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: jari
status: open
priority: normal
preparation: ready
lane: proto-onboarding
lane_seq: 1
---

# Prototype: site-configured onboarding (default repo, stale filter, Google step) and inviting people

## Description

Jari 2026-10-23, from the Northwind pilot onboarding: a site such as Northwind's should be able to
1. pre-select, or automatically check out for every new person, a default repository (e.g. `Northwind/northwind-monorepo`), even skipping the repo step;
2. hide stale repositories from the chooser (e.g. no commits for more than 14 days);
3. include the Google integration as a step of onboarding;
4. let an administrator configure these onboarding steps in Settings › Palvelin, and invite new people to the server there;
5. configure the same from the CLI, so an installing agent can set up the site's onboarding and permissions while bringing the service up.

Jari: prototype all of this first and make good plans; do not replace the current service yet and do not decide implementation before the plans.

Prototype round (same method as earlier proto-* rounds in `design-system/prototypes/rounds/`: production context, 2–3 directions per surface, desktop/390 px, light/dark, synthetic data, published for review with a Finnish summary and recommendation):
- the onboarding flow with a site default repository (auto vs pre-selected), stale filtering and the Google step;
- Settings › Palvelin: onboarding configuration and inviting people (and what an invite means: GitHub username → admission; pending/accepted states; revoking).

Plus a short planning document (in this issue) for Jari's decision: where the site's onboarding configuration lives (site declaration applied by `host apply` vs runtime admin settings vs both), the CLI surface (`host` vs `admin`), and who holds the authority to admit/invite (today the root broker owns admission; the browser and gateway hold no admission authority) — options with the reasoning and one recommendation. No implementation.

## Acceptance Criteria

- [ ] Published prototype review with directions and a recommendation per surface; planning document with options and a recommendation; nothing in production changes.
