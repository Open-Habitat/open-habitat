---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/agent-experimental-features
lane: unlaned
lane_seq: 1
collision: [contracts/v1/]
preparation: ready
closed: 2026-11-15
---

# The agent can list experimental features and which are on

## Description

Jari 15.11.2026 (test server): the person's Open Habitat agent cannot tell
which experimental features the person has turned on, nor which ones exist.
When testing, the agent did not know what was on. The agent should be able
to answer "mitkä kokeelliset ominaisuudet minulla on päällä ja mitä on
tarjolla", and the configurable settings in general should be queryable from
the agent.

Today: experimental switches are account preferences kept by the person's
daemon (`internal/daemon/account_preferences_linux.go`), read in the browser
through `useExperimentalFeature` (`web/src/app/accountPreferences.ts`), with
cards in Settings › Kokeelliset ominaisuudet
(`web/src/components/ExperimentalFeatures.tsx`). Other settings already have
agent commands that write the same native files (`agent model`,
`agent recap-settings`, …).
