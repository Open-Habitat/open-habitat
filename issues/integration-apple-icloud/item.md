---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: done
priority: normal
preparation: ready
lane: unlaned
collision: [internal/daemon/integrations, web/src/components/Integrations]
closed: 2026-10-24
---

# Apple (iCloud) integration: choose services, one app-specific password, onboarding step

## Description

Implement the Apple (iCloud) integration Jari chose in `proto-apple-icloud-integration` (Decisions 2026-10-24; round source `design-system/prototypes/rounds/2026-10-24-apple-icloud/`, result.md):

- An **Apple** tile in Asetukset › Integraatiot, direction 2 "Valitse palvelut": one Apple ID and one app-specific password; the person chooses which of iCloud Mail (IMAP `imap.mail.me.com`, SMTP as the mail integration needs), Calendar (CalDAV `caldav.icloud.com`) and Contacts (CardDAV `contacts.icloud.com`) to connect. The Vaiheittain guide for creating the app-specific password, with Apple's documented steps as cited in the round.
- The tile is composed from the existing `imap`, `caldav`, `carddav` accounts by their stored server (no new store); Jari's existing iCloud CardDAV connection shows in it.
- *Yhdistä samalla salasanalla* reuses the stored app-specific password for adding another Apple service when that works safely within the person's own UID (the password stays in the native tool configs; it is never returned to the browser); otherwise ask again.
- Mail username gap noted by the round (IMAP name part vs SMTP full address; Apple ID vs iCloud Mail address): resolve per Apple's documentation.
- Apple as an onboarding integration step like Google (site-added via Käyttöönotto; shown only when available), using the same tile.
- Generic IMAP/CalDAV/CardDAV forms stay as they are.

## Acceptance Criteria

- [x] Fake-server tests for each service with Apple's hosts (DAV discovery from `dav-icloud-discovery`), password reuse confined to the person's own config, stories and a browser spec (choose services, add one later with the same password, remove), onboarding step spec.
- [x] KOKEILTAVAA.md line for Jari with his real Apple ID. Review: independent `/llm-review` (credential reuse).

## Resolution

### 2026-10-24T14:11:11Z · @issuectl

Valitse palvelut delivered: Apple card composed from imap/caldav/carddav accounts by stored server, password reuse confined to Apple-hosted accounts in the person's own configs and Apple's endpoints, separate SMTP username for iCloud Mail, onboarding step. Review: one confirmed must-fix (foreign SMTP relay on renewal) fixed in aab25ec3; result.md lists decisions for later review.
