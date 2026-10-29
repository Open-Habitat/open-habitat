# Result: anyone with the link can open a shared view

## Jarille

Ehdotus on [ADR 0033](../../docs/decisions/adr-0033-view-capability-links.md).
Se odottaa hyväksyntääsi, eikä tuotekoodia ole tehty.

**Malli.** Ville painaa näkymäkortissa *Jaa linkillä*, valitsee voimassaolon
(oletus 30 päivää) ja kopioi linkin Pekalle. Linkin avaaja ei kirjaudu. Hän
näkee sivun Habitatin kehyssivulla. Kehyksessä lukee, että sisältö on
käyttäjän jakamaa eikä palvelu ole tarkistanut sitä. Sisältö on jäädytetty
kopio kuten nyt. Kun agentti tekee uuden version, linkki ei muutu itsestään.
Ville voi vaihtaa linkin osoittamaan uudempaa näkymäänsä, ja osoite pysyy
samana. Hän voi myös jatkaa linkin voimassaoloa, vaihtaa sen uuteen tai
perua sen.

**Valtuudet.**
- Linkin voi luoda, muuttaa ja perua vain ihminen itse selaimessa.
- Agentti ei saa linkkitoimintoa eikä näe linkkien osoitteita, joten
  huijattu agentti ei voi julkaista mitään palvelun nimissä.
- Gateway tallentaa linkit omaan tilaansa.
- Sisältö luetaan omistajan daemonilta samaa reittiä kuin nyt. Kotihakemistosta
  ei kopioida mitään muualle.
- Ylläpitäjä voi perua minkä tahansa linkin.
- Operaattori kytkee linkit päälle sivustokohtaisesti `views.public_origin`
  -asetuksella. Oletuksena ne ovat pois päältä.

**Mikä muuttuu arkkitehtuurissa.** Tähän asti gateway on lukenut ihmisen
daemonia vain hänen omalle kirjautumiselleen. Jatkossa se lukee yhden
linkitetyn näkymän myös anonyymille avaajalle. Tämä on muutos, jonka hyväksyt.

**Pääriski on huijaussivu palvelun osoitteessa.** Näkymän skriptit voivat
nykyään ohjata sivun itsensä minne tahansa ja viedä kirjoitetun tekstin
mukanaan. Siksi jaettu sisältö näytetään aina skriptittömässä kehyssivussa,
joka estää siirtymisen pois jakopalvelimelta. Linkkien osoite kannattaa
lisäksi pitää erillisessä verkkotunnuksessa, esimerkiksi Northwindilla ei
`acme.test`:n alla. Jos jaettu sivu joutuu Googlen haittasivulistalle, lista
ei silloin osu yrityksen omaan verkkotunnukseen. Saman sivuston alla oleva
osoite on myös sallittu.

**Rajoitukset.**
- Avaaja voi aina tallentaa näkemänsä, eikä peruminen saa sitä takaisin.
  Valintaikkuna sanoo tämän.
- Jos agentti muuttaa linkitetyn näkymän tiedostoja paikallaan, muutos näkyy
  linkissä. Muutettu sisältö pysyy kuitenkin samassa eristyksessä. Erillinen
  kopio kodin ulkopuolella estäisi tämän, mutta toisi toisen sisältövaraston.
- Nimetty jakaminen saman palvelimen käyttäjille jää yhä lykätyksi. Linkki
  riittää Pekan tapaukseen.

**Päätät:** hyväksytkö mallin, erityisesti

1. sen, että agentti ei saa luoda linkkejä;
2. sen, että sisältö luetaan omistajan daemonilta eikä kopioida julkiselle
   alueelle;
3. suosituksen erillisestä verkkotunnuksesta (ei pakko).

## Decisions for later review

- **Link store in the gateway, not the owner's home.** A daemon-checked token
  kept in the home would need no gateway state, but any same-UID agent could
  then publish. The gateway store is a new persistent file beside sessions.
- **Tokens are kept so the person can copy a link again.** Hashing them like
  session secrets would protect a leaked gateway-state backup, but the person
  would lose "copy link". A compromised gateway can already read every export.
- **One public host, with the token in the path.** A token in a per-link
  hostname would leak through DNS and SNI. Content runs in an opaque origin, so
  per-link hosts would add nothing. The cost: root-relative URLs in a view
  break under a link.
- **The frame page and the `Sec-Fetch-Dest` gate.** These are what keep typed
  text in. The implementation must prove in Chrome, Firefox and Safari that
  the page's `frame-src` stops the framed content from navigating itself away.
- **Expiry choices 1/7/30 days or the operator's maximum (default 90).** No
  "never". An extension is one click.

## What was done

- Read the issue, `research-ville-feedback` (report and result), ADR 0032, the
  `agent-html-artifacts` research §4–6 from history, the gateway and daemon
  view code, the session store, revocation and Access code, the operations
  views section, and the agent view skill.
- Wrote ADR 0033 and its index row, and set the issue's preparation to
  `pending`.
- Not done: no browser experiment on `frame-src` confinement and no external
  model review.
