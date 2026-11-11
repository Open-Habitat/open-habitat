# Tulos

Syy: juuri aloitetun keskustelun nimeäminen epäonnistui selaimessa ennen
kuin pyyntöä edes lähetettiin. Nimeäminen (`railRename.save`,
`web/src/app/App.tsx`) haki keskustelun työtilan snapshotin agenttilistasta,
ja jos seuraava snapshot ei vielä ollut tuonut uutta keskustelua, se heitti
virheen. Otsikon nimikenttä näytti silloin *Nimeä ei voitu tallentaa*.
Sivu oli auki ja nimeäminen käytössä, koska keskustelusivu tietää jo
keskustelun ja sen työtilan. Elävän reitin snapshot-luku kestää sekunteja,
ja kun vuoro on käynnissä toisessa keskustelussa, lukuja on jonossa.

Todisteet Birchlta (vain lukien): 11.11. klo 09:37:44 aloitettiin uusi
keskustelu (`POST /api/v1/conversations`, open-habitat). Sen session
tiedostoon tuli `session_info` *Pääluuppi* klo 09:38:02.323, samalla hetkellä
kuin journaalin `POST /api/v1/conversations/{id}/{id}` 200. Toinen 200 klo
09:38:14.866 on *TODO-looppi* → *pilot.28 (oli TODO-looppi)* kesken käynnissä
olevan vuoron, ja sekin kirjoittui. Kumpikaan onnistunut pyyntö ei siis
näyttänyt virhettä. Virheen antanut yritys ei näy journaalissa, koska se ei
koskaan lähtenyt selaimesta. Labissa sama toistui varmasti: kun
snapshot-luvut pidätetään uuden keskustelun aloituksen jälkeen, otsikosta
nimeäminen näyttää virheen eikä `/name`-pyyntöä lähde. Ilman korjausta
testi odottaa pyyntöä turhaan.

Korjaus: keskustelusivu antaa nimeämiselle työtilansa (tai työpuunsa, sama
paikka, jolla sivu muutenkin puhuu keskustelusta). Snapshotin agentti
voittaa, kun se on jo listassa. Daemonin `nameByHand` kirjoittaa nimen
käynnissä olevan Pi:n kautta. Sivupalkin rivillä nimeäminen on edelleen
pois käytöstä, kunnes snapshot tuntee rivin. Vain sivu tietää paikan.

Muut ehdokkaat tarkistettiin labissa (`pi-deltas`, otsikko ja sivupalkki):
nimeäminen heti aloituksen jälkeen, kun snapshot on jo ehtinyt, kesken
käynnissä olevan vuoron, vuoron jälkeen sekä toisen, käynnissä olevan
keskustelun nimeäminen sivupalkista. Kaikki onnistuivat ilman virhettä.

Regressiotesti: `web/tests/lab-conversation-name.spec.ts` *a conversation
just started is named before a snapshot lists it* pidättää snapshotit,
nimeää otsikosta, odottaa onnistuneen `/name`-vastauksen ilman virhettä ja
näkee nimen latauksen jälkeen.

## Decisions for later review

- **Sivun tuntema paikka riittää nimeämiseen.** Vaihtoehto: pitää nimeäminen
  pois käytöstä, kunnes snapshot listaa keskustelun. Valitsin paikan
  käyttämisen, koska daemon ei luota selaimen tietoon (se nimeää vain oman
  istuntonsa tai todistetusti kirjoittajattoman historian), joten väärä paikka
  johtaisi kieltäytymiseen, ei väärään kirjoitukseen. Lisäksi juuri aloitetun
  keskustelun nimeäminen on luonteva ensimmäinen teko.
