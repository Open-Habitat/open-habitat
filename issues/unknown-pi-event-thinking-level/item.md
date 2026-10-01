---
created: 2026-10-01
updated: 2026-10-01
type: bug
reporter: Jari
status: open
priority: high
related: ['@pilot14-session-revalidation-loop']
---

# Pi:n thinking_level_change näytetään virhekorttina keskustelun alussa

_Source: chat_

## Havainto (Jari, pilot.15, 2026-10-01)

Uuden keskustelun alussa näkyy korostettu kortti "Tuntematon tapahtuma: Tapahtuman muotoa ei tueta · thinking_level_change · {...}" ja sen alla "Pi-tapahtuma", "Alkuperäinen sisältö", "Kopioi tiedot". Kuva liitteenä.

## Syy

Pi 0.85.1 kirjoittaa istuntoon `thinking_level_change`-tapahtuman (kuten `model_change`, joka renderöidään siististi "Malli vaihtui · …"). Selaimen tapahtumaparseri ei tunne tyyppiä ja renderöi sen virhekorttina JSON-sisältöineen.

## Odotus

Tunnetut Pi:n istuntotapahtumat (`thinking_level_change` ja muut asetusmuutokset) näytetään samalla hiljaisella tilarivillä kuin mallin vaihto, tai ei lainkaan. Oikeasti tuntematon tapahtuma ei saa näyttää virheeltä eikä kaataa JSONia käyttäjän eteen; riittää pieni harmaa rivi, jonka voi avata.
