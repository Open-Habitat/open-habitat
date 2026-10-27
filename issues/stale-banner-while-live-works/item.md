---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: open
priority: high
provenance: chat
source_ref: chat:2026-10-27/stale-banner-while-live-works
lane: connection-state
preparation: ready
---

# 'Yhteys katkesi' banner while the live stream clearly works

## Description

Jari 2026-10-27 klo 7.39 (Birch, pilot.12): banneri 'Yhteys katkesi · tiedot voivat olla vanhoja. Näet viimeksi vahvistetut tiedot. Kirjoittavat toiminnot odottavat yhteyttä; luonnos ja lukukohta säilyvät. [Yhdistä]' näkyi, vaikka agentti työskenteli, tila päivittyi ja uusia viestejä tuli live-yhteyden kautta (kuva attachments/banner.png).

Vihje: composer-focus-stolen-by-interim (laskeutunut 2026-10-27) löysi, että epäonnistunut tilannekuvan (snapshot) päivitys live-vuoron aikana vaihtaa vaiheen authenticated → stale. Selvitä todisteilla (Birchn gateway- ja daemon-lokien http_request-tietueet, ei keskustelujen sisältöä), miksi snapshot-päivitys epäonnistuu (aikakatkaisu, kuorma, 5xx), ja korjaa niin, että yksittäinen epäonnistunut päivitys ei näytä yhteyden katkeamista, kun live-yhteys toimii; banneri vain todelliselle yhteyskatkolle ja Yhdistä tekee jotain (vrt. reconnect-live-cause).

## Acceptance Criteria

- [ ] Syy näytetty todisteilla; banneri ei näy, kun live-virta toimii; selaintesti kattaa epäonnistuneen snapshot-päivityksen elävän vuoron aikana
