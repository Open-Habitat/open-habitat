---
created: 2026-10-24
updated: 2026-10-24
type: task
status: open
priority: normal
preparation: ready
lane: unlaned
---

# Prototype: where people learn the OneDrive/Dropbox folder bridge (onboarding, moment of need, card)

## Description

Jari, 2026-10-24: own-computer files go through a synced OneDrive or Dropbox folder (`remove-browser-folder-sharing`, 2026-10-21). Today the only guidance is a small paragraph (`CloudFolderHint` in `web/src/components/Integrations.tsx`) that is easy to miss: Jari, looking at his connected Dropbox card, could not find where it appears. "Musta meidän pitäisi tosi mielikuvituksekkaasti pohtia, että missä vaiheessa me mietitään, missä tämä asia tulee? Kenties jopa on-boardaamisessa?"

Prototype round: where and when a person learns that the cloud folder is the bridge between their own computer and the agent, and how it is set up on their own machine. Explore divergent, imaginative placements, for example:
- an onboarding step or a part of an integration step ("Oma kone" — connect OneDrive/Dropbox and install its sync client), possibly site-configurable like other onboarding steps;
- the moment of need: the composer's Liitä menu, an agent reply that mentions a file on "your computer", dropping a large file, a screenshot paste;
- the connected account card itself (folder path, "Avaa omalla koneella" instructions per OS, status);
- the agent's own behaviour (it suggests the folder when asked to deliver a file to the person's machine).
3–4 directions with real differences; Finnish, short text (Jari removes explanation); production components; PICKER.md tablet, desktop/390 px, light/dark, synthetic data.

## Acceptance Criteria

- [ ] Round published on a new glasspad page with a Finnish summary, recommendation and questions in result.md; KOKEILTAVAA prototype line.
