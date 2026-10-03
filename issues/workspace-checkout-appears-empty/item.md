---
created: 2026-10-01
updated: 2026-10-03
type: bug
reporter: Jari
status: fixed
priority: high
related: ['@pilot14-session-revalidation-loop']
closed: 2026-10-03
closed_by: jari
---

# Agentti näkee northwind-monorepo-työtilassa vain .git-hakemiston

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Agentti sanoo northwind-monorepo-työtilassa, että hakemistossa ei ole muita tiedostoja kuin `.git`-kansio.

## Tutkittavaa

Onko checkout oikeasti tyhjä (clone keskeytynyt, vain `.git` kirjoitettu, sparse tai bare), vai käynnistetäänkö Pi väärässä hakemistossa (työtilan juuri vs. jokin alihakemisto tai home)? Palvelimen havainto kirjataan tähän issueen.

## Comments

### 2026-10-01T17:54:20Z · @claude

Palvelinhavainto 2026-10-01: /home/maintainer/src/northwind-monorepo sisältää vain .git-hakemiston, jonka koko on 2,2 GB. Siinä ei ole yhtään refiä eikä committia (HEAD osoittaa refs/heads/master, 'No commits yet'), count-objects näyttää 0 pakattua objektia ja .git/objects/pack/tmp_pack_OenDMW on jäänyt keskeneräiseksi. Kaikki tiedostot ovat ajalta 2026-09-29 16:51, eli ensikäytön onboardingin clone keskeytyi (iso monorepo) eikä sitä koskaan saatu loppuun. Muut työtilat (ergona-monorepo, tailspin-monorepo, native-agent-host) ovat kunnossa. Daemon listaa hakemiston työtilana pelkän .git-kansion perusteella, joten Pi käynnistyy tyhjässä puussa. Korjattavaa kaksi: keskeytynyt clone ei saa näkyä työtilana (tai se siivotaan ja tarjotaan uudelleen), ja ison repon clone pitää saada loppuun; liittyy @show-large-clone-progress ja ADR-0005:n rajaukseen, ettei osittaista hakemistoa siivota.

## Resolution

### 2026-10-03T16:05:50Z · @jari

Jari confirmed on 2026-10-03 that this has been fixed. Close the observed empty-checkout bug; no remaining work requested under this issue.
