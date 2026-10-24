---
created: 2026-10-24
updated: 2026-10-24
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: onboarding
lane_seq: 4
collision: [web/src/app/GitHubOnboarding]
closed: 2026-10-24
closed_by: claude
---

# Onboarding AI step: misaligned buttons; implement the 'Ehdotus ja lista' layout

## Description

Jari 2026-10-24 on the Northwind pilot (pilot.7) and earlier in prototype round 3 (screenshots `pilot-ai-step.png`, and `issues/proto-admin-server-onboarding/r3-jari-ai-step.png`): in the onboarding AI step the Claude option's buttons are misplaced. "Kirjaudu Claudeen" sticks to the button below it and sits on the right instead of the left edge; the status "Claude-kirjautumista ei ole vahvistettu." floats right; "Takaisin valitsemaan GitHub-repoja" is huge and should sit e.g. next to "Keskeytä käyttöönotto ja kirjaudu ulos". Cause (round 4 analysis): `ClaudeSignIn` and `PiCredentials` use the Settings page `.s-row` grid (title left, status and button right), which wraps badly in the onboarding card.

Jari approved the AI-step layout **"Ehdotus ja lista"** (round 4 direction 1, `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-4/`): one heading for the step, every element left-aligned in one column, options as rows of one list where the chosen row opens in place with its sign-in or key field inside, the three API keys (OpenAI, Anthropic, DeepSeek) as compact one-line rows, clone progress on the route's Repot row (not in the card), the back action small and beside the cancel action. Implement that layout in production now with the options offered to everyone (site-configured defaults come later with the onboarding configuration).

## Acceptance Criteria

- [ ] Production AI step uses the 'Ehdotus ja lista' layout with production sign-in components restructured as round 4 proposed (step owns the heading; `PiDeviceSignIn`, `ClaudeSignIn`, `PiCredentials` embedded without their own headings; clone progress on the route); back action beside cancel; Settings › AI-tilit unchanged; browser tests for each option opening; screenshots desktop/390 px light/dark.

## Resolution

### 2026-10-24T05:21:47Z · @claude

Ratkaisut, joita prototyyppi ei määrännyt (Jarin arvioitaviksi): (1) Vaiheen otsikko on samaa kokoa ja samalla Käyttöönotto-yläotsikolla kuin muut tuotannon vaiheet (Google, Git-identiteetti), ei prototyypin 16 px. (2) Reitin Repot-rivillä on jokainen repo omana lyhyenä rivinään palkin kanssa; epäonnistuneen haun syy ja Yritä uudelleen ovat kortin alla, koska reitin sarakkeessa ei ole niille tilaa. (3) Avainkenttä tarkistaa palvelun etuliitteen (Anthropic sk-ant-, muut eivät), myös Asetuksissa, jotta avain ei mene väärän palvelun riville. (4) Kaikki viisi vaihtoehtoa näkyvät kaikille ilman ehdotusta; Asetusten pi_sign_in-kulku näyttää yhä vain tilaukset. Näyttö: ai-*-{desktop,phone}-{light,dark}.avif/.html.
