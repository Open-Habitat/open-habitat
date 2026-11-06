---
created: 2026-11-05
updated: 2026-11-06
type: task
reporter: jari
status: done
priority: high
related: ['@landing-server-did-not-answer']
preparation: pending
provenance: chat
source_ref: chat:2026-11-05/proto-landing-connection-status
lane: landing-proto
lane_seq: 1
closed: 2026-11-06
---

# Prototype: honest connection status and automatic read recovery on the loading landing

## Description

Jari 5.11.2026: aloitussivun *Työtiloja ei saatu näkyviin — Palvelin ei
vastannut* pitää kertoa paremmin, mistä on kyse. Vika-analyysi
`landing-server-did-not-answer` (result.md, *Triage analysis*) osoitti,
että sivulle päädytään myös palvelimen vastatessa: sessioluku epäonnistuu,
selaimen aikaraja (60 s / 20 s) umpeutuu, yhteys katkeaa VPN:n, DNS:n tai
wifin takia, tai istunto ja snapshot nimeävät eri henkilön kolmesti.
Väite "palvelin ei vastannut" on siis usein väärä. Sivu palautuu itse vain
selaimen `online`-tapahtumasta; VPN-reitin katkossa sitä ei tule, ja sivu
jää odottamaan nappia.

Prototypoi: rehellinen tila (selaimen ilmoittama offline vihjeenä, muuten
neutraali "yhteyttä ei saatu", ei väitettä palvelimen kaatumisesta), miten
rajattu automaattinen uudelleenluku (vain lukuja, kasvava väli) ja nykyinen
*Yritä uudelleen* elävät yhdessä, ja miltä pysyvä identiteettiristiriita
näyttää (se pysyy fail-closed). Ei uusia diagnostiikkapalveluita eikä
kirjoitusten uusintaa. Prototyyppikierros AGENTS-WORKFLOW.md:n mukaan.

## Decision (Jari 2026-11-06)

Suunta **B Laskuri**. Kun istunto ja tiedot eivät täsmää, ensisijainen
teko on *Kirjaudu uudelleen*. Automaattinen yrittäminen lopetetaan noin 15
minuutin kohdalla, mihin kasvavan välin sarja osuu. Toteutus issuessa
`landing-server-did-not-answer`.

## Acceptance Criteria

- [ ] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
