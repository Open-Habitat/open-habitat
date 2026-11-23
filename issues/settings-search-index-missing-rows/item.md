---
created: 2026-11-23
updated: 2026-11-23
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: taskfleet worker observation
source_ref: taskfleet:01m84a4p384fjr55gj3xr22cd8/settings-search-main-failure
originating_run: 01m84a4p384fjr55gj3xr22cd8
originating_run_kind: spinoff
---

# settings-search spec: drawn settings rows missing from the search index

## Description

`web/tests/settings-search.spec.ts` › "every index row is on its section's page and every page row is in the index" fails on main (seen 2026-11-23, focused run `./scripts/test-focused.sh --area browser --spec settings-search.spec.ts`).

Settings pages draw rows whose `data-settings-row` ids are missing from `settingsSections` (`web/src/app/settingsIndex.ts`):

```
own-machines-ssh-config, sounds-active-device, rail-state-motion,
workspace-header-c2a, reply-to-message
```

So settings search cannot find these rows. Most look like experimental-feature rows drawn from `internal/experimental/catalog.json` that the index does not list, plus the Omat koneet SSH-config row.

Done when the index and the drawn rows agree again (either index the rows or have the test derive experimental rows from the catalog) and the spec is green.
