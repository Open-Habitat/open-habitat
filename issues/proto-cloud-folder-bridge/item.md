---
created: 2026-10-24
updated: 2026-10-25
type: task
status: obsolete
priority: normal
preparation: pending
closed: 2026-10-25
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

- [x] Round published on a new glasspad page with a Finnish summary, recommendation and questions in result.md; KOKEILTAVAA prototype line.

## Decisions

### 2026-10-24T08:44:48Z · @jari

Jari 2026-10-24, round 1: riff the Aloitus direction. The onboarding step asks 'Onko sinulla henkilökohtainen Dropbox tai OneDrive?' and is of course not asked if one of these was already connected through an integration step earlier on the route. Next: round 2 riffing this step.

### 2026-10-24T09:40:51Z · @jari

Jari 2026-10-24, round 2: if Microsoft 365 was already connected (its OneDrive), the question is not asked. On the folder: no separate 'Open Habitat' folder; instead the bridge is the person's existing backups of Documents and Downloads (e.g. OneDrive's folder backup / Dropbox Backup syncing those folders), so screenshots and downloads are naturally there.

### 2026-10-24T11:57:50Z · @jari

Jari 2026-10-24, round 3: chose Desktop (Työpöytä) over Downloads, then tested Dropbox Backup himself (needed a paid plan; 14-day trial): Desktop/Documents/Downloads backups appear at dropbox.com/backups/Mac, a space separate from the ordinary Dropbox files, and the test server's agent does not see them. Conclusion (Jari): return to the concept of a separate 'Open Habitat' folder in the person's cloud as the bridge.

### 2026-10-24T14:27:52Z · @jari

Jari 2026-10-24: doubts the cloud-folder bridge altogether — 'Musta tää on vain niin vaikea tapa', especially for Downloads. He has considered replacing the web interface with native software at some point, where own-computer files need no such workaround and computer use could pass through it. Conductor: the bridge is parked (deferred) in favour of that direction; ordinary attachments and the existing OneDrive/Dropbox integrations stay as they are. The rounds 1–3 results remain the record if it is revived.

### 2026-10-25T16:07:43Z · @jari

Jari 2026-10-25: closed; the own-computer file bridge will be solved another way.

### 2026-10-25T16:08:05Z · @jari

Jari 2026-10-25: 'another way' means the native client (native-client-local-files): own-computer files reach agents through it, not through a synced cloud folder.
