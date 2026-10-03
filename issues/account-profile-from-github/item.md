---
created: 2026-10-02
updated: 2026-10-03
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:7-8
related: ['@decide-account-display', '@restore-v2-navigation', '@restore-v2-settings']
blocked_by: ['@unify-ui-primitives']
lane: account-ui
lane_seq: 20
---

# Make the signed-in account recognizable across the UI

## Problem

Jari reported on 2 October 2026 that the account still reads "Oma tili" and
Settings has no email, and asked for the GitHub name and profile image. The
interface does not clearly tell the person whose account they are using.

## Agreed behavior

Show the person's first name in the compact account view and their email when
the account view is opened. GitHub is the source; onboarding asks for the name
or email if GitHub does not provide it, as decided in @decide-account-display.
Use the GitHub profile image to help the person recognize their account, with
a usable presentation when no image is available.

These are display details. The existing authenticated identity and Unix-user
binding determine whose account and data the person can access; entering an
email during onboarding does not change that identity.

## Implementation approach

Trace how GitHub profile information reaches the application and why the current
views lack it. WorkspaceRailView currently supplies the literal "Oma tili".
Resolve the data flow and shared account presentation so the sidebar, account
menu and settings consistently describe the same signed-in person. The work
includes supplying missing profile information and the agreed onboarding fallback,
not just replacing the label in one view.

Coordinate the sidebar and settings changes with @restore-v2-navigation and
@restore-v2-settings. The result should make the account recognizable after login
and after switching accounts, including when GitHub lacks some display details.

## Decisions

### 2026-10-02T10:07:59Z · @codex

Jari hyväksyi 2.10.2026 läpikäynnissä rajauksen: "Oma tili" ja puuttuvat profiilitiedot ovat oire siitä, ettei käyttöliittymä kerro selvästi kenen tilillä toimitaan. Toteuttaja selvittää profiilitiedon kulun GitHubista yhteiseen tiliesitykseen, jotta sivupalkki ja asetukset käyttävät sitä johdonmukaisesti. Aiempi etunimi/sähköposti-päätös ja puuttuvien tietojen kysyminen onboardingissa säilyvät; GitHub-profiilikuva täydentää tunnistettavuutta. Näyttötiedot eivät muuta tilin todennettua identiteettiä. Issuen teksti uudistettu tämän mukaan; toteutusta ei tehty.
