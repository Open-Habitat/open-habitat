---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-14/revoked-access-keeps-quota
preparation: pending
---

# Removing a person's access keeps their quota in the disk sum

## Description

Jari 14.11.2026 (test server): an administrator removed a person's access on
"Käyttäjät ja pääsy" so that the sum of quotas (112 GiB) would drop below the
disk (97.87 GiB). The person stayed on the Levytila list with their 25 GiB
limit (9.69 GiB used), the sum did not change and the warning stayed; it
cleared only when the administrator lowered that person's quota by hand.
The product has no person removal (`docs/operations.md`, "no supported …
deprovision"); removing access only stops services. An administrator
expects removal to free space.

Decisions for Jari: should Levytila show on the row that the person no
longer has access (and offer lowering the limit or cleaning the home); should
quotas of people without access be left out of the sum; or is a real person
removal needed that says what happens to the data.
