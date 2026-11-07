---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: clone-url
lane_seq: 1
---

# New workspace search does not accept a GitHub URL

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Uusi työtila -haku ei hyväksy GitHub-osoitetta (Jari 1.11., pilot.572–584, englanniksi): kun hakukenttään liittää `https://github.com/maintainer/testi-repo`, sivu sanoo *No matches for https://github.com/maintainer/testi-repo. Type owner/repo and we will look it up on GitHub.* Kentän pitää hyväksyä GitHub-osoite (myös `.git`-pääte, `git@github.com:…`-muoto ja polku repon perässä) ja muuttaa se lennossa muotoon `omistaja/repo`. Sama koskee käyttöönoton oletusrepon kenttää. Tekstit: `web/src/text/clonePage.tsx`, `web/src/text/onboardingSettings.tsx` (`clone-empty-repo`, `typed-repo-unselectable-without-github`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
