---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
lane: unlaned
collision: [internal/provision]
closed: 2026-10-24
---

# Broker refuses to replace an invalid integration section (integrations_file_invalid)

## Description

Jari, 2026-10-24 17:05, test server 0.0.0-pilot.387: following the instructions from `microsoft-tenant-migration` (Integraatiot › Microsoft 365 › Aseta tunnukset… › Minulla on jo sovellus, Application ID + Directory (tenant) ID, Tallenna), the save is refused: "Palvelimen integraatiotiedosto vaatii ylläpitoa komentoriviltä. Mitään ei muutettu." (`integrations_file_invalid` from the broker).

Likely cause: the broker parses `/opt/open-habitat/integrations.json` strictly before splicing one section, and the test server's existing Microsoft section (tenant `common`, written by Fleetrepo) is now invalid under the single-tenant rule, so the broker refuses every write — including the one that would fix it. The admin row tells the administrator to fix exactly that section in the browser, so the product contradicts itself.

Goal: the broker may replace or clear a provider's section that is invalid under current rules, as long as the file is otherwise well-formed JSON of the expected shape and every other section and `tools` are kept byte for byte; a structurally broken file still requires the command line. Confirm the live cause on the test server (metadata only; never print secrets), then let Jari's save succeed.

## Acceptance Criteria

- [ ] Broker tests: an invalid-under-current-rules Microsoft section can be replaced and cleared; other bytes unchanged; a malformed file is still refused.
- [ ] Live cause in result.md; after the release, the Microsoft save works on the test server (worker may verify with a dry-run/read, not by writing Jari's values).
- [ ] Review: independent `/llm-review` (root write path).
