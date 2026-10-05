# MVP:n käyttöliittymäkatselmus

Tämä paketti on valmis Jarin päätettäväksi. Se ei ole hyväksyntä. Tavoite on
lukita toteutettava keskustelukäytös jo hyväksytyn workspace-suunnan rinnalle,
ei valita frontend-tekniikkaa tai arvioida mockeja backend-testinä.

## Katso nämä

1. [Yhtenäinen kirjautumisesta keskusteluun kulkeva polku](https://github.com/maintainer/native-agent-host/blob/90ef1565f1df46da9ade73b885db2d5bb2c4a837/docs/ui.md#kirjautuminen-ja-työtilan-valinta)
2. [Tuotteen tavoite ja sovitut toiminnot](../../docs/product.md)
3. [Pi 0.85.1:n todellinen ohjausnäyttö](../probe-pi-control/result.md#capability-matrix)
4. [Workspace-, GitHub-, Taskfleet- ja poistokokeen näyttö](../probe-workspace-lifecycle/result.md#outcome)
5. [Kriittisten oletusten yhteenveto](../../docs/assumptions.md)

Visuaaliset referenssit:

- keskustelun [klikattava pääpolku](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/vedokset/Keskustelu%20paapolku.dc.html),
  [B1–B10 ja B12 -tilat](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/vedokset/Tilat%20B1-B12.dc.html)
  sekä [B5a–B5f-työkalutilat](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/vedokset/Tilat%20B5.dc.html);
- hostin [klikattava A1–A9-päävedos](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/workspaces/Agenttilista%20vasemmalla.dc.html)
  ja [A1–A9-yhteenveto](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v1/workspaces/Yhteenveto%20A1-A9.dc.html);
- [yhteinen design system](../../design-system/AGENTS.md).

HTML-vedosten data, ajastimet, jonot, virheet ja toiminnot ovat simuloituja.
Niiden JSX/HTML-rakenne ei ole tuotantoarkkitehtuuripäätös.

## Jo hyväksytty suunta — ei avata ilman teknistä estettä

Jari hyväksyi 2026-09-21 yhden palvelimen workspace- ja agenttinavigoinnin
ensimmäisen funktionaalisen MVP:n suunnaksi. Koko MVP sisältää workspacejen
luonnin, asetukset, piilotuksen ja turvallisen poiston, estävän Git-integroinnin,
GitHub-create/clone/push-polut, Taskfleetin hallitsemat agentti-worktreet,
arkiston ja jatkamisen sekä sovitut automaattiset luonnin jälkeiset fokusoinnit.
Kahden Linux-käyttäjän erottelu ja reconnect kuuluvat hyväksymiseen.

Rajat säilyvät:

- workspace on `~/src`:n välitön hakemisto; yleistä workspace-rekisteriä ei ole;
- Pi-historiaa ei kopioida, vaan jatkaminen käyttää samaa `pi:<sessionId>`-ID:tä;
- Git, Pi, Linux ja Taskfleet omistavat omat faktansa;
- vain Taskfleetin omistamia worktree-agentteja hallitaan; muut näkyvät read-only;
- agentti käyttää Unix-käyttäjän credential-ympäristöä, ei uutta credential brokeria;
- symlinkki, epävarma prosessi tai tuntematon vaikutus estää tuhoavan toiminnon;
- mobiili, usea palvelin, B11 ja [L1–L13](../native-agent-host-architecture/ui-design-later.md) eivät kuulu tähän v1-kohteeseen.

Kokeet eivät pakota poikkeamaa tähän suuntaan. Ne pakottavat tekemään
terminaaliagentista read-onlyn ilman hallittua siirtoa sekä esittämään GitHub- ja
poisto-operaatiot vaiheittaisina osatuloksina. GitHubin kirjoitusoperaatiot ja
selain-credential-flow tarvitsevat edelleen myöhemmän luvallisen testin.

## Päätä nämä kahdeksan kohtaa

Hyväksy suositus sellaisenaan tai kirjaa korjaus jokaiseen poikkeavaan kohtaan.
Tarkempi käyttäytyminen on [alkuperäisessä UI-dokumentissa](https://github.com/maintainer/native-agent-host/blob/6bcabaa451e4b0927548c408622dee5a0e44fe36/docs/ui.md#avoimet-valinnat-ja-valmistelijan-suositus).

1. **Jono ja steering.** Hyväksytäänkö kaksi lähteen mukaista toimintoa:
   `steer` = “Ohjaa tämän vuoron jälkeen” ja `follow_up` = “Suorita valmistumisen
   jälkeen”, näkyvä järjestetty jono sekä koko jonon tyhjennys (`clear_queue`),
   joka palauttaa tekstit editoriin? Suositus: kyllä; yksittäisen viestin
   perumista tai käynnissä olevan työkalun keskeyttämistä ei luvata.
2. **Synopsis.** Hyväksytäänkö v1:een “Uusi keskustelu” tai ensimmäisen
   käyttäjäviestin deterministinen yhden rivin alku ilman malligenerointia tai
   uutta tallennusta? Suositus: kyllä.
3. **Fokus ja luonnos.** Hyväksytäänkö fokus vain käyttäjän valinnan tai
   onnistuneen create/resumen jälkeen ja palvelin-, identiteetti- ja
   agenttikohtainen luonnos `sessionStorage`ssa reloadin yli mutta ei välilehden
   sulkemisen yli? Suositus: kyllä; logout/käyttäjän vaihto tyhjentää luonnokset,
   eikä palvelintallennusta lisätä.
4. **Lukukohta.** Hyväksytäänkö auto-scroll vain pohjassa, muuten “Uutta sisältöä”,
   ja avatun ryhmän/lukukohdan säilytys natiivitapahtuman UI-avaimella?
   Suositus: kyllä.
5. **Huomio.** Riittävätkö v1:een sovelluksen sisäinen lukumäärä, agenttirivin
   tekstimerkki ja dokumentin otsikon luku ilman selain-/OS-ilmoituksia?
   Suositus: kyllä.
6. **Ohjattavuus ja terminaalisiirto.** Hyväksytäänkö havaittu elävä TUI vain
   luettavaksi ja resume vain varmasti päättyneelle prosessille? Stale,
   tuntematon tai puuttuva prosessihavainto estää resumen. Suositus: kyllä;
   “Siirrä selaimen ohjaukseen” pyytää käyttäjää lopettamaan TUI:n terminaalissa
   tai käyttää tunnetun omistajan stop-kanavaa, odottaa prosessin poistumisen ja
   historian asettumisen ja käynnistää vasta sitten RPC-runtimen. Daemon ei
   signaloi vain havaittua prosessia.
7. **Epävarma lähetys.** Hyväksytäänkö host-sopimukseen idempotentti asiakkaan
   command ID, näkyvä “Tulos epävarma” ilman automaattista uusintaa ja snapshotiin
   perustuva selvitys? Suositus: kyllä; tuntematon ID jää epävarmaksi, ellei
   daemon voi todistaa toimittamatta jäämistä. Uusi tietoinen lähetys on eri
   komento. ID:n säilytys ja retention päätetään host-sopimuksessa.
8. **Osittaiset host-operaatiot.** Hyväksytäänkö yhteinen vaihelista, joka ei
   väitä rollbackia, uusii vasta tuoreen natiivihavainnon jälkeen ja merkitsee
   poiston valmiiksi vasta uuden lähdelistauksen jälkeen? Suositus: kyllä.

## Yksi läpikävely ennen päätöstä

Arvioi yksi yhtenäinen toteutustavoite seuraavista lähteistä. Vedoksesta
klikattava tila arvioidaan visuaalisena referenssinä; “tekstinä” merkityt kohdat
ovat päätettäviä vaatimuksia ja myöhempiä integraatiotestejä, eivät mockissa
suoritettavia toimintoja.

1. **Host-vedos A1–A3 + tekstinä:** kirjaudu Jarina, odota gatewayta ja daemonia,
   avaa `~/src`:stä workspace. Tarkista väärä mapping ja vanhentunut kirjautuminen
   vedoksesta; Kaisan täydellinen erottelu hyväksytään tekstinä/testitavoitteena.
2. **Host-vedos A5/A9 + keskusteluvedos B7/B8 + tekstinä:** avaa natiivi historia.
   Pelkkä avaaminen ei resumoi. Vertaa hallittua RPC-agenttia, varmasti päättynyttä
   keskustelua, havaittua TUI:ta ja tuntematonta prosessihavaintoa; kaksi viimeistä
   ovat read-only ja estetyt kontrollit kertovat syyn.
3. **Keskusteluvedokset B2, B4–B9:** resume, lähetä ja seuraa streamia. Tarkista
   Markdown, koodi, kopiointi, ryhmitellyt työkalut, `edit`-diffi, geneerinen
   fallback, extensionin tuettu käyttäjäpyyntö ja vuoron keskeytys. Keskeytys ei
   ole prosessipuun stop.
4. **Keskustelupääpolku + tekstinä:** lähetä työn aikana molemmilla ehdotetuilla
   tavoilla, tyhjennä koko jono ja tarkista pending, hylätty ja kuittauksetta
   jäänyt epävarma lähetys.
5. **Keskusteluvedos B10 + tekstinä:** katkaise yhteys streamin ja lähetyskuittauksen
   aikana. Sisältö jää stale-merkityksi, kirjoitukset estyvät, luonnos/lukukohta
   säilyvät ja reconnect käyttää cursoria tai snapshotia ilman automaattista resendia.
6. **Host-vedos A7 + tekstinä:** luo tavallinen ja Git-workspace, käy estävä
   Git-portti, GitHubin vaiheistus, Taskfleet-worktree ja automaattinen fokus läpi.
   Pending/failed/unknown ja osittainen create/remote/push/clone/start ovat
   tekstivaatimuksia, koska kirjoitusoperaatioita ei ole vielä backend-testattu.
7. **Host-vedos A7 + tekstinä:** piilota ja palauta workspace. Poistossa tarkista
   symlinkki, havaittu prosessi, jäljellä oleva Taskfleetin tai manuaalinen
   linkitetty worktree, Taskfleet-teardown, stop-virhe, osittainen tiedostopoisto
   ja uusi lähdehavainto. Estetty toiminto ei katoa eikä näytä onnistuneelta.
8. **Host-vedos A6/A7 + tekstinä:** lopeta ja arkistoi hallittu agentti, listaa
   arkisto natiivihistoriasta ja pienestä annotaatiosta ja jatka samalla resume-ID:llä.
   Annotation virhe, puuttuva historia ja osittainen stop/archive/resume ovat
   tekstivaatimuksia myöhempään integraatiotestiin.

## Ehdotettu päätösteksti

Jos kaikki kahdeksan suositusta sopivat, Jari voi hyväksyä näin:

> Hyväksyn 2026-09-22 `prepare-ui-review`-paketin kahdeksan suositusta
> `review-ui-v1`:n toteutettavaksi UI v1 -kohteeksi. Hyväksyntä säilyttää
> 2026-09-21 hyväksytyt host-toiminnot ja Unix-natiivit rajat. HTML/JSX-mockit
> ovat visuaalisia referenssejä, eivät backend- tai tuotantoarkkitehtuurinäyttöä.
> B11, [L1–L13](../native-agent-host-architecture/ui-design-later.md), mobiili ja
> usean palvelimen näkymä jäävät tämän kohteen ulkopuolelle. Hyväksyn myös
> `docs/ui.md`:n komponenttiperheinventaarion ja avoimet adapterivaatimukset
> kirjattuina; tuotantokirjasto ja runtime päätetään myöhemmin. GitHubin
> kirjoituspolku, host-sopimukset ja tuotantotekniikka hyväksytään ja todennetaan
> niiden omissa myöhemmissä porteissa.

Jos jokin kohta muuttuu, kirjaa numerot ja korvaava käytös. `review-ui-v1` pysyy
auki, kunnes päätös ja mahdollisten korjausten tulos on kirjattu. Valmistelija ei
hyväksy eikä sulje ihmisarviota.
