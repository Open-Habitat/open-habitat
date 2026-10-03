---
created: 2026-10-02
updated: 2026-10-03
type: task
reporter: jari
status: in-progress
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:4-6
related: ['@refine-agent-status', '@review-browser-design-v2', '@restore-v2-navigation']
---

# Find and address the causes of inconsistent UI interaction feedback

## Problem

Jari repeatedly encounters controls whose appearance and interaction feedback
vary between views. On 2 October 2026, the home agent list and repository-name
hover felt good, while the account-avatar menu and other buttons or menus lacked
equally clear feedback. The sidebar also showed a large "Päivitä" text button
where the draft uses a curved-arrow icon, and its agent rows lacked the expected
status marks. These are examples of a recurring problem, not an exhaustive repair
list or proof of a particular cause.

## Investigation and recommendation

Explain from the current code why these differences keep appearing and recommend
a software design that makes consistent behavior the ordinary result of building
a view. Trace representative good and bad examples through their components,
interaction states and styles. The earlier
[UI foundation assessment](../review-browser-design-v2/assessment.md) offers leads
about local overrides and fragmented presentation; its historical findings need
to be checked against the current implementation.

The application already uses React Aria Components and its own shared primitives.
Evaluate how that foundation is used, what established UI frameworks or component
libraries could supply, and which of their design ideas would help here. Reusing
more of the existing library, improving the application's abstractions, or adopting
a different library are possible conclusions. Recommend the option supported by
the observed causes, considering consistency, accessibility, maintenance and the
cost of adoption. A framework change is not a predetermined outcome.

## Useful outcome

Produce a code-grounded explanation and a concrete recommendation for the shared
UI foundation, illustrated with representative controls in different views.
Show how hover, keyboard focus, pressed, selected and disabled states would be
handled consistently, and why future controls would inherit that behavior.
Describe the implementation path and how to demonstrate the improvement across
views. Fixing only the reported controls does not answer the recurring problem.
Major dependency or architecture choices are discussed with Jari under the
project's normal decision policy.

The meaning and visual language of agent states belong to @refine-agent-status.
This investigation explains how such a shared presentation can be used reliably
throughout the UI. Coordinate the resulting work with @restore-v2-navigation and
@review-browser-design-v2 so their view-level changes use the same foundation.

## Decisions

### 2026-10-02T10:05:17Z · @codex

Jarin täsmennys 2.10.2026: raportoidut hover-, painike- ja valikkoerot ovat oireita. Tehtävä on löytää koodista syyt siihen, miksi epäjohdonmukaisuutta syntyy toistuvasti, ja suositella yleinen arkkitehtoninen tai ohjelmistotekninen ratkaisu. Selvityksessä saa arvioida vakiintuneiden UI-frameworkien toiminnallisuuden tai suunnitteluperiaatteiden hyödyntämistä ja kirjaston käyttöönottoa; ratkaisua ei valita etukäteen. Pelkkä lueteltujen oireiden korjaaminen ei täytä tavoitetta. Agenttitilojen merkitys ja yhteinen visuaalinen kieli käsitellään erikseen olemassa olevassa @refine-agent-status-issuessa.

### 2026-10-03T05:44:01Z · @claude

Tutkimus tehty 3.10.2026 (Claude, ei delegoitu): [investigation.md](investigation.md). Syy: vuorovaikutustilat eivät kuulu minkään primitiivin sopimukseen; React Arian data-hovered/pressed/focus-visible-attribuutteja ei käytetä tyyleissä, hover-säännöt on lisätty neljään näkymäkohtaiseen valitsimeen eri viipaleissa, kontrolleja rakennetaan kolmella tavalla, ja kahdeksan esi-isäohitusta tyylittää Buttonia ulkoapäin vaikka recut-ui-foundation kuittasi sen poistetuksi. Mittaus labin näkymistä: Button-variantit, agenttirivit, valikon rivit ja tilivalikon laukaisin eivät reagoi hoveriin tai painallukseen. Suositus: ei kirjastovaihtoa; React Aria loppuun asti, primitiivit omissa CSS-moduuleissa, yksi tilaresepti, näkymä ei tyylitä primitiiviä, gateen väite että jokainen kontrolli on primitiivi ja reagoi hoveriin ja fokukseen, designerille tilamatriisi. Odottaa Jarin kantaa vaiheen A aloitukseen.
