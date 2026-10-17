---
created: 2026-10-17
updated: 2026-10-17
type: epic
owner: jari
status: open
priority: normal
---

# Integrations to other systems for agents (SharePoint, Google, …)

Jari, 2026-10-17 (in short): people should be able to integrate their other systems so that agents can use the data: import SharePoint into the user's home directory (as OneDrive does), Google Drive, Gmail and other sources agents need. Use as a basis what integration points OpenClaw has built, and to what extent OpenClaw's work can be reused, even so far that an integration made for OpenClaw would automatically be available here, though our UIs may differ. Research which integrations are wanted, how each can be implemented, and how agents learn about the data (system prompt, skills dropped into the home directory when an integration is added, or something else). Then prototype how adding an integration goes.

Epic-sized. Steps:
1. **Research** (`research-integrations`): OpenClaw's integration model and reuse; candidate integrations and per-integration implementation; how agents discover integrations; credential handling under the Unix-user boundary.
2. **Architecture decision with Jari** from the research (which component owns credentials and sync, reuse of OpenClaw, agent exposure), recorded as an ADR.
3. **Prototype round** of adding and managing an integration.

## Acceptance Criteria
- [ ] Research report reviewed with Jari; architecture decision recorded; prototype round chosen; implementation issues filed.
