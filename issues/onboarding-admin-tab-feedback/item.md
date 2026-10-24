---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: done
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/app/OnboardingAdministration, web/src/components/OnboardingSettings]
closed: 2026-10-24
---

# Käyttöönotto tab: icon, dialog footer, visible repo selection, no preselected Google, autosave

## Description

Jari, 2026-10-24, trying Asetukset › Käyttöönotto on the test server (0.0.0-pilot.355):

1. **Tab icon**: the Käyttöönotto icon looks like the corner/chevron used everywhere as the "opens a menu" sign. Use another icon from the existing icon set that reads as onboarding/route.
2. **Lisää oletusrepo dialog**: with more than a few repositories the dialog grows so long that *Valmis* scrolls out of view. Give the dialog a fixed footer with *Valmis* (body scrolls, footer stays; also at 390 px).
3. **Selecting from "Viimeksi päivitetyt"**: a chosen repository disappears from that list and shows up only in the selected section lower down. "Toimii periaatteessa mutta on jotenkin epäselvä." Make the selection visible where it was made (e.g. the row stays and shows as selected/checked and can be unchecked there), with the selected set still summarised.
4. **Google preselected as an integration**: a fresh configuration has Google automatically chosen as an onboarding integration. "Ei tehdä näin." The default integration list is empty; the administrator adds steps.
5. **Save bar**: the larger button touches the rule below it (spacing). And Jari asks for **automatic saving**: every change goes live without *Tallenna käyttöönotto* / *Peru muutokset*. Implement autosave that keeps the existing optimistic-concurrency rule: each change is sent with the version it was based on; a status line shows *Tallennetaan…* / *Tallennettu* / a concrete failure; a conflict (another administrator saved meanwhile) is shown and resolved by reloading, never by overwriting; text input (typed `owner/repo`) saves on commit, not per keystroke. Remove the save/cancel buttons. Record the exact behaviour under "Decisions for later review" in result.md.

Code: `web/src/app/OnboardingAdministration.tsx`, `web/src/components/OnboardingSettings.tsx` (+ stories/tests), the gateway default in `internal/gateway/onboarding.go`.

## Acceptance Criteria

- [x] Items 1–5 in production with tests/stories; autosave covers success, failure and a two-tab conflict (browser spec); mobile layout.
- [x] KOKEILTAVAA.md line replaced.
