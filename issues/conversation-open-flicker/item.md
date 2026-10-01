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

# Keskustelun avaus välähtää tyhjän kanvaksen ja viivästyneen lopun kautta

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Kun keskustelu avataan esimerkiksi etusivulta, vasemmassa tilassa näkyy ensin noin puoli sekuntia "Aloita keskustelu." tyhjällä kanvaksella, sitten näkymä vaihtuu itse keskusteluksi, ja vielä puolen sekunnin päästä keskustelun loppu ("Vuoro valmis … odottaa viestiäsi" ja composer) ilmestyy.

## Syy, alustava

`BrowserConversation.tsx` renderöi tyhjän tilan ennen kuin historia on luettu, ja tila/häntä (status, live tail) tulee erillisestä luvusta tai virrasta. Kolme peräkkäistä renderöintiä kolmesta eri lähteestä.

## Odotus

Keskustelu avautuu yhdellä renderöinnillä: näytetään joko latausindikaattori paikallaan tai heti valmis näkymä. Tyhjän keskustelun "Aloita keskustelu." näkyy vain silloin, kun keskustelussa oikeasti ei ole mitään.

## Lab resolution (2026-10-01)

Browser test loads status and history in parallel, holds one response, and asserts the ready view only after both; lab first-use and existing conversation journeys pass. The final committed implementation `f5f0a6f` passed the clean JSON CI gate (110 Chromium browser cases and 13 lab cases). No test-server deployment or visual verification occurred in this worker; the next release must verify this user-visible defect on the test server.

## Acceptance Criteria

- [x] The conversation opens in one loading transition without an empty history/partial status flash.

## Resolution

### 2026-10-01T23:34:32Z · @claude

Fixed in browser-state-rewrite; synthetic Chromium and clean lab gate passed on f5f0a6f. No test-server verification in this worker; verify visual behavior on the next release.
