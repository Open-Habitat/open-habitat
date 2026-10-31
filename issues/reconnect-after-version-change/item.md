---
created: 2026-10-30
updated: 2026-10-31
type: bug
reporter: jari
status: fixed
priority: high
lane: reconnect
lane_seq: 2
preparation: ready
closed: 2026-10-31
---

# After a version change Yhdistä does nothing; the banner should lead to reload

## Description


## Description

Jari 30.10. klo 16.23–16.24, Birch (pilot.16, rebootin jälkeen),
kuvakaappaukset `attachments/`: banneri "Yhteys katkesi · tiedot voivat olla
vanhoja · Palvelimen tilaa ei saatu tarkistettua. Yritä uudelleen." ja
*Yhdistä*-painike, joka ei tee mitään. Samaan aikaan ilmoituksissa on
"Uusi versio on saatavilla · Lataa uudelleen". Jari: selittävä tekijä on se,
että versio vaihtui, mutta käyttöliittymä tarjoaa silti Yhdistä-painiketta.

Todennäköisesti vanha selainpaketti ei enää saa yhteyttä uuteen versioon
(sopimus tai reitti muuttui pilot.15 → pilot.16), joten uudelleenyhdistäminen
ei voi onnistua. Liittyy `reconnect-live-cause`-korjaukseen (yksi luku
kerrallaan, virta herää koneen mukana), joka on pilot.16:ssa.

## Acceptance Criteria

- [x] Kun palvelimen versio on vaihtunut eikä vanha paketti voi yhdistää,
      banneri sanoo sen ja sen toiminto on *Lataa uudelleen* (luonnokset
      säilyvät), ei toimimaton *Yhdistä*.
- [x] Syy nimetty: miksi Yhdistä ei tee mitään (mikä pyyntö epäonnistuu
      versioiden välillä); selainspec versionvaihdosta kesken istunnon.

## Comments

### 2026-10-31T04:04:03Z · @jari

Jari 30.10. (testikone pilot.536, toinen tietokone): sama toistui testikoneella. Välilehdellä oli *Yhteys katkesi* ja *Yhdistä*, mutta palvelin oli sillä välin päivitetty, eikä painallus palauttanut yhteyttä. Kun syy on uusi versio, ilmoituksen pitää sanoa se ja tarjota *Lataa uudelleen* (kuten kellon uuden version kohta). Ilmoitus: web/src/components/Status.tsx:196 (reconnect-live-cause, notification-bell-status). Tämän takia 'Yhdistä toimii agentin työskennellessä' jäi kokeilematta.
