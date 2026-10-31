---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: done
priority: normal
lane: recap-settings
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Recap settings: delay beyond 9 min, Oma on the same row, card link opens the overlay

## Description

## Description

Kolme Jarin havaintoa 30.10. (testikone pilot.536, `recap-settings-levels`):

1. **Viive enintään 9 min on liian lyhyt.** Asetukset › Tilannekatsaus › *Hiljaisuus ennen katsausta* päättyy 9 minuuttiin, koska pysähdykset rajattiin Pi:n 10 minuutin joutopysäytykseen (`recapDelayStops`, `web/src/components/RecapSettings.tsx:82-87`, ja `recap_settings_linux.go`). Jarin mielestä Pi:n lepo ei ole syy rajata tätä: viiveen pitää voida olla myös 10, 15, 20 min tai enemmän. Katsaus osaa jo käynnistää levänneen Pi:n vain katsausta varten (`automatic-recap-lost-on-restart`).
2. **Katsauksen laajuus -valitsimessa *Oma* putoaa toiselle riville** (työpöytä, asetukset sivupaneelina): Lyhyt / Tavallinen / Perusteellinen ensimmäisellä rivillä ja Oma yksinään alla.
3. **Katsauskortin asetuslinkki avaa asetukset tavallisena sivuna**: kortin ratas tai *Asetukset* (`settingsHref`, `web/src/components/RecapCard.tsx:134-138`) on suora linkki, joten asetusten X palaa etusivulle eikä keskusteluun (vrt. `settings-close-returns`).

## Acceptance Criteria

- [x] Viiveen voi valita myös yli 10 min (esim. 10, 15, 20, 30, 60 min), ja yli joutopysäytyksen menevä katsaus tulee levänneelle Pi:lle oikein.
- [x] Kaikki neljä laajuutta mahtuvat yhdelle riville tai asettuvat siististi sivupaneelissa ja puhelimella.
- [x] Kortin asetuslinkki avaa asetukset kuten muualta, ja X palauttaa saman keskustelun samaan kohtaan; selainspec.
