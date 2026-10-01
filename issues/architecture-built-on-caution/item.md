---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: Jari
status: open
priority: high
related: ['@pilot14-session-revalidation-loop']
---

# Arkkitehtuuri on rakennettu varovaisuuden, ei tarpeen varaan

## Ongelma

Pilot.14:n istuntosilmukan juurisyy (@pilot14-session-revalidation-loop) ei ollut yksittäinen bugi vaan arkkitehtuurivalinta: jokainen natiiviluku ja kahden tapahtumavirran joka toinen sekunti käynnistivät kokonaisen Pi-ajoympäristön Node-prosessissa kysyäkseen, onko OpenAI-kirjautuminen voimassa. Valinnalle ei ollut syytä. Se ei suojannut mitään, koska Unix-käyttäjä on jo turvallisuusraja ja Pi-tunnukset ovat käyttäjän omia tiedostoja. Se oli olemassa vain siksi, että agentti kirjoitti kommentin "a fresh native check is made for each request" ja seuraavat agentit sulattivat sen sääntönä.

Jari 2026-10-01: tämä on vahva indikaatio siitä, että koko tähän mennessä tehty arkkitehtuuri on kuraa. Ei siksi, että yksi portti oli kallis, vaan siksi, että näin typerä ratkaisu pääsi syntymään, läpäisi katselmoinnit ja päätyi julkaisuun asti ilman, että kukaan kysyi, mitä se maksaa ja mitä se suojaa.

## Mistä ilmiö näkyy

Sama kuosi toistuu koodissa laajemmin. Esimerkkejä, joista mikään ei vielä ole tutkittu loppuun:

- `internal/daemon/handoff_linux.go`: "No positive result is retained across requests, refreshes or daemon restarts." Sääntö ilman syytä; seurauksena pilot.14-silmukka.
- `internal/gateway/auth.go`: broker tarkistetaan uudelleen jokaisella istunnollisella pyynnöllä, "Never cache a positive decision." Mitä tämä suojaa, kun istunto on jo gatewayn muistissa ja peruutus on erillinen operaatio (ADR-0006)?
- `internal/daemon/pi_device_linux.go`: asennusvalitsin tarkistetaan uudelleen ennen jokaista natiivikutsua.
- `web/src/app/App.tsx`: välilehteen paluu peittää koko näkymän "Varmistetaan istuntoa" -peitteellä ja tekee neljä peräkkäistä palvelinlukua ennen kuin käyttäjä näkee mitään. Tavallinen ikkunan vaihto on tehty poikkeustilanteeksi.
- `internal/gateway/snapshot_linux.go` ja `conversation_linux.go`: daemonin HTTP-vastaus hylätään, ellei se ole tavulleen odotetun muotoinen (protokollaversio, yksi Content-Type-otsake, täsmällinen Content-Length, ei chunkattua siirtoa), vaikka daemon on oma binäärimme omalla Unix-socketillaan. Kiinteät 5 sekunnin budjetit ilman mittausta.
- Koko: `BrowserConversation.tsx` 1740 riviä, `daemon/conversation_linux.go` 1445 riviä, `App.tsx` 1022 riviä. Tiedostot ovat kasvaneet lisäämällä tarkistuksia, eivät jäsentämällä.

Yhteinen piirre: mekanismi on perusteltu kommentilla, joka toteaa säännön, ei syytä. Katselmoinnit ovat vahvistaneet, että sääntöä noudatetaan, eivät kysyneet, pitäisikö sääntöä olla. Lopputulos näyttää turvalliselta ja on käytännössä hidas, hauras ja käyttäjälle sietämätön.

## Mitä halutaan

Tuotteen arkkitehtuuriperiaate on kirjoitettu `CLAUDE.md`:hen: Unix-käyttäjät ovat turvallisuusraja ja natiivit komponentit ovat totuus. Kaikki muu on toteutusta, jolla on hinta. Jokaisen rajoitteen, tarkistuksen ja portin pitää vastata kysymykseen: mitä käyttäjälle arvokasta tämä suojaa, mitä se maksaa ja mitä tapahtuu, jos se poistetaan. Jos vastaus on "ei mitään" tai "en tiedä", mekanismi poistetaan.

## Työ

1. Arkkitehtuurikatselmus, joka listaa jokaisen puolustavan mekanismin gatewayssa, daemonissa ja selaimessa: mitä se tarkistaa, kuinka usein, mitä se maksaa (mitattuna, ei arvattuna) ja mitä se oikeasti suojaa. Tulos on taulukko, jossa jokaisella rivillä on tuomio: säilytä syyn kanssa, yksinkertaista, tai poista.
2. Taulukko käydään läpi Jarin kanssa ja päätökset kirjataan. Säilytettävät mekanismit saavat kirjatun syyn; muut poistetaan omina issueinaan.
3. `internal/AGENTS.md` ja `docs/architecture.md` päivitetään sanomaan suoraan, mikä on turvallisuusraja ja mikä ei ole, jotta seuraava agentti ei keksi uutta porttia varmuuden vuoksi.
4. Katselmointikäytäntö: koodikommentti tai aiemman agentin perustelu ei ole syy. Katselmoija kysyy jokaisesta tarkistuksesta, mitä se suojaa.

Tämä issue ei ole lupa kirjoittaa tuotetta uusiksi. Se on lupa poistaa se, mille ei löydy syytä.
