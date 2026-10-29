# Tulos: kiintiövaroitus ennen kuin kirjoitukset katkeavat

## Mitä tehtiin

- **Kello** (`web/src/app/StoragePressure.tsx`): tallennustilan kohta näkyy
  85 %:sta (*Tila lähes täynnä*, hiljainen kello) ja 95 %:sta kello itse on
  punainen (*Tila melkein täynnä*, otsikossa prosentti). 95 %:n teksti kertoo,
  että täysi tila katkaisee tallennukset kesken, myös agenttien
  keskusteluhistoriat, ja neuvoo vapauttamaan esim. käännösvälimuistit ja
  vanhat worktreet. Aiemmin raja oli 90 % ilman porrastusta. Sama koskee
  asennusta ilman käyttäjäkohtaisia kiintiöitä (yhteinen levy).
- **Agentit**: Pi:n ympäristöohje (`internal/daemon/host-context.md`) ja
  agent-taito (`internal/cli/agent/SKILL.md`) käskevät tarkistamaan
  `open-habitat agent environment show --json` -kiintiön ennen isoja
  käännöksiä, klooneja ja latauksia, kertomaan ihmiselle yli 85 %:ssa ja
  vapauttamaan ensin uudelleen tuotettavat (`go clean -cache`,
  `npm cache clean --force`, `cargo clean`, yhdistetyt worktreet), ei koskaan
  ihmisen omia tiedostoja kysymättä.

## Todisteet

- `StoragePressure.test.tsx`: 84 % ei mitään, 85/94 % varoitus, 95/100 %
  vaara. `quota-pressure.spec.ts` (selain): 91 % hiljainen kello, 96 %
  punainen kello ja *melkein täynnä (96 %)*, takaisin 91 %:iin hiljainen.
- Web-yksikkötestit 973/973, `go test ./internal/cli`.
- Katselmointi: kohdennettu itsearvio (ei daemonin tilaa, sopimusta eikä
  valtuuspolkua).
- Testikoneella varmistus on KOKEILTAVAA-rivinä (vaatii julkaisun).

## Päätökset myöhempää katselmointia varten

- **Kynnykset 85 % ja 95 %** kuten issue ehdotti; 95 % nostaa kellon
  punaiseksi samoin kuin täysi tila. Vaihtoehto oli pitää 95 % keltaisena;
  punainen valittiin, koska Birchn tapauksessa kukaan ei huomannut hiljaista
  varoitusta ajoissa.
- **Agentit oppivat ohjeesta, eivät ilmoituksesta.** Vuoron aikaista
  automaattista ilmoitusta agentille ei tehty: `agent environment show`
  kertoo kiintiön jo, ja ohje käskee katsomaan sen ennen isoa työtä. Jos
  tämä ei riitä, seuraava askel olisi kiintiötieto vuoron alun
  kiinnijuoksuun.
