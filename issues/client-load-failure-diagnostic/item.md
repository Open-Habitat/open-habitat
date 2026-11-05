---
created: 2026-11-05
updated: 2026-11-05
type: feature
reporter: jari
status: done
priority: high
related: ['@landing-server-did-not-answer']
preparation: ready
provenance: chat
source_ref: chat:2026-11-05/client-load-failure-diagnostic
lane: client-diagnostic
lane_seq: 1
closed: 2026-11-05
---

# Browser reports a recovered load failure to the gateway journal

## Description

Jari 5.11.2026: "Pääasia on että jatkossa tieto on tarkempaa." Villen
4.11. aloitussivun syytä ei saatu selville, koska selain ei kerro
palvelimelle mitään: `reconnectDiagnostic` (`web/src/app/reconnectDiagnostic.ts`)
kirjoittaa vain konsoliin ja vain erikseen kytkettynä, ja palvelimen
journal näkee vain pyynnöt, jotka perille tulivat. Analyysi
`landing-server-did-not-answer` (result.md) listaa polut, jotka vievät
aloitussivulle palvelimen vastatessa.

Tee: kun selain on joutunut `daemon_unavailable`-tilaan (tai `stale`-tilaan)
ja yhteys taas toimii, se lähettää gatewaylle pienen diagnostiikkailmoituksen,
jonka gateway kirjaa journaliin (esim. `client_load_failed`): mikä polku
(sessioluku: verkko/virhe/epäkelpo; snapshot: verkko/HTTP-status/epäkelpo;
aikaraja; identiteettiristiriita), mikä luku, kesto, `navigator.onLine`
epäonnistumishetkellä, montako yritystä, kauanko tila kesti, ja
tunnistettu henkilö vain siinä muodossa kuin http_request-rivit jo
kirjaavat. Ei sisältöä, URL-polkuja parametreineen, evästeitä, tunnuksia
eikä vapaata tekstiä selaimelta; kentät ovat suljettuja luetteloita ja
rajattuja lukuja, jotta selain ei voi kirjoittaa journaliin mitä tahansa.
Rajoita määrä (yksi ilmoitus tilaa kohden, gatewayn puolella nopeusraja).
Sopimus `contracts/v1/`-kautta. Käyttöliittymään ei muutoksia; sivun
näkyvä syy/tunniste kuuluu prototyyppiin `proto-landing-connection-status`.

## Acceptance Criteria

- [x] toipunut aloitussivun tai stale-tilan epäonnistuminen näkyy gatewayn journalissa polun, keston ja online-tilan kanssa; testit synteettisellä hostilla (offline, sessioluvun virhe, aikaraja, identiteettiristiriita)
- [x] gateway hylkää tuntemattomat arvot ja rajoittaa määrän; ei henkilötietoa tai sisältöä journaliin; docs/operations.md kertoo, miten tapahtumaa luetaan
