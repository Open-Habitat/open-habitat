---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: fixed
priority: high
related: ['@pilot14-session-revalidation-loop', '@browser-state-rewrite']
lane: caution-removal
lane_seq: 65
blocked_by: ['@browser-state-rewrite']
closed: 2026-10-01
closed_by: claude
---

# Istunnon varmistuspeite peittää näkymän jokaisella päivityksellä

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

1. Aina kun näyttö päivittyy, näkyy jonkin aikaa "Varmistetaan istuntoa" -peite, ja koko käyttöliittymä on tahmea.
2. Kun ikkunaan palataan toisesta ikkunasta, näkymä on aina "Varmistetaan istuntoa" -tilassa, ikään kuin sivu renderöitäisiin uudestaan fokuksen vaihtuessa.
3. Kun agentti käyttää työkaluja, "Varmistetaan istuntoa…" -peite välkkyy päälle ja pois.

## Mistä se tulee

`web/src/app/App.tsx`: `refresh()` asettaa `verifying`-tilan, joka piirtää koko näytön peitteen ja merkitsee sisällön `aria-hidden`/`inert`-tilaan, kunnes istunto ja snapshot on luettu uudelleen. `refresh()` kutsutaan ikkunan `focus`/`visibilitychange`-tapahtumista, `BrowserConversation.tsx`:n `turn.settled`-tapahtumasta, virran katkoista ja uudelleenyhdistämisistä sekä `onResnapshot`-kutsuista. Pilot.15 poisti Pi-tilan tarkistuksen näistä, mutta peite ja uudelleenlukujen määrä ovat ennallaan, ja jokainen luku kestää sen minkä gateway ja daemon kestävät.

Tämä on @architecture-built-on-caution -ilmiön selainpuoli: jokainen tilanmuutos käsitellään epäluotettavana, kunnes palvelin on vahvistanut sen uudelleen, ja vahvistus näytetään käyttäjälle peitteenä.

## Odotus

Ikkunan vaihto, agentin työkalukäyttö ja vuoron valmistuminen eivät peitä näkymää. Snapshot päivitetään taustalla ja näkymä vaihtuu paikallaan. Identiteetin vaihtuminen (eri käyttäjä samassa selaimessa) on ainoa tilanne, jossa vanha sisältö pitää piilottaa, ja se on harvinainen poikkeus, ei jokaisen fokusvaihdon oletus.

## Lab resolution (2026-10-01)

Idle synthetic Chromium: 60 seconds and focus/visibility/blur changes resulted in zero session/status/snapshot/events requests after settling; normal updates keep existing content visible. The final committed implementation `f5f0a6f` passed the clean JSON CI gate (110 Chromium browser cases and 13 lab cases). No test-server deployment or visual verification occurred in this worker; the next release must verify this user-visible defect on the test server.

## Acceptance Criteria

- [x] Focus return and background event updates leave the view mounted without an identity mask.

## Resolution

### 2026-10-01T23:34:32Z · @claude

Fixed in browser-state-rewrite; synthetic Chromium and clean lab gate passed on f5f0a6f. No test-server verification in this worker; verify visual behavior on the next release.
