---
created: 2026-10-24
updated: 2026-10-24
type: task
status: in-progress
priority: normal
preparation: pending
lane: unlaned
---

# Prototype: Apple (iCloud) integration tile with app-specific password guidance

## Description

Jari, 2026-10-24: iCloud contacts now connect through the generic CardDAV form (`dav-icloud-discovery`), and the agent finds and edits contacts. "Voisiko sinne laittaa tämän Apple-integraation tavallaan omana täppänä, jossa kanssa autetaan tämän sovellussalasanan asettaminen."

Prototype round: an **Apple (iCloud)** integration of its own in Asetukset › Integraatiot (and as a possible onboarding integration step), which connects iCloud Mail (IMAP `imap.mail.me.com`), Calendar (CalDAV `caldav.icloud.com`) and Contacts (CardDAV `contacts.icloud.com`) with one Apple ID and one app-specific password, and guides creating that password (account.apple.com › Sign-In and Security › App-Specific Passwords; two-factor authentication required). Verify current Apple wording and steps from Apple's documentation (cite). Decide whether one tile connects all three or lets the person choose; how it relates to the generic IMAP/CalDAV/CardDAV tiles (which stay for other providers). Same method as earlier rounds (production components, PICKER.md tablet, desktop/390 px, light/dark, synthetic data, shared check). Keep text short.

## Acceptance Criteria

- [ ] Round published on a new glasspad page with a Finnish summary, recommendation and questions in result.md; KOKEILTAVAA prototype line.
