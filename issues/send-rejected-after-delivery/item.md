---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: fixed
priority: high
lane: send-path
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# A delivered message is shown as rejected after a duplicate send

## Description

## Description

Jari 30.10. (testikone pilot.535, työpöytä): Jari lähetti yhden viestin (*KAikki noi toimii*) kerran. Pi sai sen ja vastasi (daemonin `POST /api/v1/conversations/{id}/send` 200 klo 12:40:03.395Z, käyttäjärivi istuntotiedostossa 12:40:03.404Z). 4 s myöhemmin, kun agentti jo työskenteli, selaimesta lähti toinen `send` (12:40:07.984Z, request_id `Nfd5f0__mbpMfQ_F`), johon daemon vastasi 409. Teksti palautui kenttään, ja keskusteluun tuli *Hylätty · teksti säilytettiin* sekä *Viesti hylättiin. Tarkista keskustelun tila.*, vaikka viesti oli jo perillä. Jari ei painanut lähetystä toiseen kertaan. Noin 6 s aiemmin (12:39:57) hän oli nimennyt saman keskustelun sivupalkin kynällä (Enter). Hylkäyksen polku: `web/src/app/ConversationActions.tsx:213-219` (`NotAdmitted` 409:stä, `web/src/app/conversations.ts:191`). Lisäksi ilmoitus ei kerro, mitä tapahtui tai mitä tehdä.

## Acceptance Criteria

- [x] Nimetty, mikä lähetti toisen `send`-pyynnön (epäilty: nimeämisen Enter tai sen kohdistus kirjoituskenttään), ja korjattu niin, ettei sama viesti lähde kahdesti.
- [x] Jo perille mennyttä viestiä ei koskaan näytetä hylättynä eikä palauteta kenttään; aidon hylkäyksen ilmoitus kertoo syyn ja mitä tehdä.
- [x] Selainspec: nimeäminen sivupalkissa ja heti perään lähetys.
