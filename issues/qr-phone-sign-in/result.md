# Result

**Yhteenveto Jarille.** Suosittelen, että työpöydän asetuksissa painetaan "Kirjaudu puhelimella", jolloin gateway näyttää QR-koodin. Koodi on voimassa minuutin ja kelpaa kerran. Puhelin skannaa sen, näyttää "Kirjaudu nimellä Jari?" ja saa oman istuntonsa. Työpöytä näyttää heti, mikä laite koodia käytti, ja sen voi kirjata ulos.
Päinvastainen suunta, jossa puhelin näyttää koodin ja työpöytä hyväksyy sen (device code, Signal-tyylinen linkitys), hylätään. Se on juuri se suunta, jota Microsoftin ja Signalin käyttäjiä vastaan on kalasteltu vuonna 2025.
Tavallisen GitHub-kirjautumisen nopeuttaminen jäi toiseksi. Se ei lisää uutta tunnistetta, mutta ei poista sitä kitkaa, josta pyysit.
Päätettävää: hyväksytkö suunnan A, ja hyväksytkö, ettei koodin näyttäminen vaadi uutta GitHub-kirjautumista? Työpöydän istunto voi jo nyt ajaa komentoja tunnuksellasi, joten uusi kirjautuminen ei suojaisi mitään.
Hinta: gatewayhin pieni muistissa pidettävä token-taulu ja muutama reitti. Istunnoille tulee laite- ja aikatiedot sekä Asetuksiin oma istuntolista, josta istuntoja voi kirjata ulos (tätä ei ole nyt lainkaan). Selaimeen tulee yksi pieni QR-kirjasto. Istuntotiedoston muoto vaihtuu, joten kaikki kirjautuvat kerran uudelleen.
Löytö matkalla: natiivin `gh`-irrotuksen "kirjauduttu 5 min sisällä" -tarkistus päättelee tuoreuden istunnon vanhenemisajasta. QR:llä tehty istunto läpäisisi sen ilman GitHub-kirjautumista, joten toteutuksen on korjattava tämä.

## Recommendation

[ADR 0018](../../docs/decisions/adr-0018-phone-sign-in-by-qr.md) (Proposed) holds the decision, the seven gateway guarantees, the threat table and the rejected alternatives. Implementation waits for Jari's acceptance and should be filed as a spinoff that covers the gateway routes and session metadata, the recent-sign-in fix, the Settings QR and session list, the `/link` page, and the tests listed in the ADR's Consequences.
