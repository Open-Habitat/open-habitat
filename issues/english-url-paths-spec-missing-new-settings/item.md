---
created: 2026-10-29
updated: 2026-10-29
type: chore
status: done
priority: normal
provenance: other
provenance_detail: pilot.15 clean gate run
source_ref: taskfleet:01m64akne6b0b1xysrxstj3enk/gate:english-url-paths
originating_run: 01m64akne6b0b1xysrxstj3enk
originating_run_kind: spinoff
closed: 2026-10-29
---

# lab-english-url-paths spec misses the keys, machines and experimental settings sections

## Description

The pilot.15 clean gate on Birch (55d844d8 and 9bbb1e80, 29.10. evening)
failed `lab-english-url-paths.spec.ts:13`: its independent list of English
settings slugs predates Settings › Avaimet (`keys`), Omat koneet
(`machines`) and Kokeelliset ominaisuudet (`experimental`), so the nav's
hrefs no longer equal the expected list. The product's slugs are English
and correct; the spec is stale.

Fix: add the three slugs in nav order.

## Resolution

### 2026-10-29T18:19:19Z · @issuectl

Spec lists the three slugs; passes alone.
