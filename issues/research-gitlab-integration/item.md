---
created: 2026-10-26
updated: 2026-10-26
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/research-gitlab-integration
lane: gitlab-provider
lane_seq: 1
preparation: pending
---

# Research: GitLab as a code service (repositories, clone, push)

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Ulkopuolisen käyttäjän firman repot ovat GitLabissa, joten Habitatin pitää osata tuoda työtiloja GitLabista samaan tapaan kuin GitHubista ja Giteasta. Jari: 'Selvitys ja prototyyppaus tästä, sitten toteutukseen. Mulla on GitLab-tili, jota voidaan testata.'

Selvitä gitlab.com ja itse ylläpidetty GitLab: tunnistautuminen (OAuth-sovellus vs. henkilökohtainen tai ryhmän access token, scopet read_api/read_repository/write_repository), repojen ja ryhmien listaus ja sivutus, HTTPS-kloonaus ja push natiivilla git credential -tuella, natiivi CLI (glab) ja sen tunnusten tallennus, sekä mitä Gitea-toteutuksesta (ADR 0031, internal/nativegitea, Koodipalvelut-sivu) voi käyttää uudelleen ja mikä eroaa. Testaus Jarin GitLab-tilillä vaatii, että Jari antaa tunnuksen tai kirjautuu itse; älä pyydä tunnusta keskusteluun. Tulos: raportti ja suositus, joka on proto-gitlab-connect-kierroksen lähtökohta.

## Result

[result.md](result.md): selvitys ja suositus (glabin tiedosto ainoana varastona, rajattu adapteri, PAT). Seuraava askel on Jarin valinta.
