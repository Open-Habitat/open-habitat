---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: open
priority: high
related: ['@pilot14-session-revalidation-loop', '@browser-state-rewrite']
lane: caution-removal
lane_seq: 65
blocked_by: ['@browser-state-rewrite']
---

# Keskustelun avaus välähtää tyhjän kanvaksen ja viivästyneen lopun kautta

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Kun keskustelu avataan esimerkiksi etusivulta, vasemmassa tilassa näkyy ensin noin puoli sekuntia "Aloita keskustelu." tyhjällä kanvaksella, sitten näkymä vaihtuu itse keskusteluksi, ja vielä puolen sekunnin päästä keskustelun loppu ("Vuoro valmis … odottaa viestiäsi" ja composer) ilmestyy.

## Syy, alustava

`BrowserConversation.tsx` renderöi tyhjän tilan ennen kuin historia on luettu, ja tila/häntä (status, live tail) tulee erillisestä luvusta tai virrasta. Kolme peräkkäistä renderöintiä kolmesta eri lähteestä.

## Odotus

Keskustelu avautuu yhdellä renderöinnillä: näytetään joko latausindikaattori paikallaan tai heti valmis näkymä. Tyhjän keskustelun "Aloita keskustelu." näkyy vain silloin, kun keskustelussa oikeasti ei ole mitään.
