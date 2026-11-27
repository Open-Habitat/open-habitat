---
created: 2026-11-27
updated: 2026-11-27
type: task
reporter: conductor
status: testing
priority: normal
provenance: chat
source_ref: chat:conductor-2711/m365-tenants-connection-identity
lane: m365-tenants
lane_seq: 1
preparation: ready
---

# Microsoft multi-tenant step 1: connection name, immutable pin, migration, no tenant-following

## Description

Step 1 of passably-subdued-sticks (design.md, 'Order of work' 1 and sections 1-2): connection name `address~tenant-GUID`, identity pinned to Microsoft's immutable ids, migration of existing connections at server upgrade without new sign-in (files and syncs stay), removal of tenant-following. On today's single-tenant configuration; no UI. Jari approved direction B and the design's recommendations 27.11.2026.
