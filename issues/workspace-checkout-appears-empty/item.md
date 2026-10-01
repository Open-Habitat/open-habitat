---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: open
priority: high
related: ['@pilot14-session-revalidation-loop']
---

# Agentti näkee northwind-monorepo-työtilassa vain .git-hakemiston

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Agentti sanoo northwind-monorepo-työtilassa, että hakemistossa ei ole muita tiedostoja kuin `.git`-kansio.

## Tutkittavaa

Onko checkout oikeasti tyhjä (clone keskeytynyt, vain `.git` kirjoitettu, sparse tai bare), vai käynnistetäänkö Pi väärässä hakemistossa (työtilan juuri vs. jokin alihakemisto tai home)? Palvelimen havainto kirjataan tähän issueen.
