---
created: 2026-10-26
updated: 2026-10-30
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-26/gitlab-integration
lane: gitlab-provider
lane_seq: 3
closed: 2026-10-27
preparation: ready
---

# GitLab as a code service: implementation

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Toteutetaan GitLab-yhteys ja repojen tuonti proto-gitlab-connect-kierroksella valitulla tavalla ja research-gitlab-integration-selvityksen teknisellä suunnalla. Hyväksyntätestaus Jarin GitLab-tilillä. Tarkempi sisältö kirjataan prototyypin valinnan jälkeen.

## Result

[result.md](result.md): glab-pohjainen GitLab-yhteys, sisäkkäiset polut yhteisessä listassa ja kloonaus, glab 1.124.0 integrations-profiilissa. Testikone tarvitsee Fleetrepo-operaattorin glabille.
