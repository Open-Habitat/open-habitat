---
created: 2026-09-29
updated: 2026-09-29
type: task
status: open
priority: normal
related: ['@build-agent-control', '@plan-v1-implementation']
lane: planning
collision: [docs/]
---

# Rethink project documents with Jari

## Tarkoitus

Käymme Jarin kanssa projektin dokumentteja läpi `/rethink-document`-skillillä,
jotta toteuttaja erottaa oikeat päätökset agentin lisäämistä vaatimuksista.
Tämä issue on jatkamiskohta: pidetään käsiteltyjen dokumenttien lista ja seuraava
ehdokas ajan tasalla, ei rakenneta erillistä katselmointiprosessia.

## Käsitelty

| Dokumentti | Lopputulos | Commit |
|---|---|---|
| [Agenttiohjauksen issue](../build-agent-control/item.md) | Tulevan toteutuksen käyttäjälle näkyvät lopputulokset, ei päätöshistoriaa. SSE ja päättyneen selainkeskustelun jatkaminen kuuluvat työhön; Pi:n kysymysdialogien vastausohjaus ja terminaaliohjauksen haltuunotto eivät; saapuneet kysymykset näytetään. | `8925a89` |
| [Toteutusbriefit](../plan-v1-implementation/implementation-briefs.md) | Lyhyt toteutuksen omistajuuskartta. Rajapintatiedot omalle sivulleen; vanhat portit ja perusteettomasti sitovat numerot pois. | `b54636a` |
| [ADR 0003: host stack](../../docs/adr-0003-host-stack.md) | Teknologiavalinta, vastuurajat ja perustelut. OAuth/OIDC-kirjaston valinta jää toteuttajalle; protokolla- ja käyttödetaljit muualle. | `4f50e89`, `855223a` |
| [Arkkitehtuuri](../../docs/architecture.md) | Käyttäjän kulku ja kolme auktoriteettia, natiivien tietojen omistajuus ja katkoista palautuminen. Kloonivirran poikkeus erotettu yleisestä tapahtumavirrasta; yksityiskohdat linkitetty omiin dokumentteihinsa. | `e78a084` |
| [Rajapinnat](../../docs/interfaces.md) | Nykyiset reitit erillään sovitusta tulevasta pinnasta; viestien merkitys, katkoista palautuminen ja vastuurajat säilyvät. Palveluasetukset asennusissuen liitteeseen. | `296e4a9`, `1c1e8f8`, `742197c` |
| [Tuotteen tavoite](../../docs/product.md) | Käyttäjän työ ja sovitut toiminnot. Nykytila erotettu tavoitteesta; vanhat MVP-portit, terminaalinsiirto ja testimatriisit poistettu tuotekuvauksesta. | Tämän päivityksen commit |

Samalla on tehty kohdennettuja korjauksia toteutussivuun, ADR 0004:ään,
CLI-konformanssiin ja liittyviin issueihin. Näitä ei ole vielä kokonaisuudessaan
käyty läpi tällä skillillä.

## Seuraavaksi

Ehdotus: [docs/assumptions.md](../../docs/assumptions.md). Sivulla vanhat
kokeet, hyväksytyt rajat ja tulevat testivaatimukset sekoittuvat. Se vaatii
edelleen terminaali→RPC-siirron testaamista, kuvaa hyväksytyn host-stackin
ehdotuksena ja jättää jo valitun credential-ratkaisun avoimeksi. Vertaa
alkuperäisiä koetuloksia myöhempiin päätöksiin ennen uudelleenkirjoitusta.
Myös UI-sivulla on vanhoja ohjaus- ja katselmointirajauksia; tällä kierroksella
korjattiin vain tuotesivun muuttuneeseen rakenteeseen liittyvä kappale.
Tuotesivun uusi teksti on valmis Jarin lukukierrokselle.

## Rajapintasivun läpikäynti 2026-09-29

Jari hyväksyi tässä keskustelussa rajauksen: nykyinen toteutus ja sovittu tuleva
pinta erotetaan, skeemien muodot linkitetään ja palveluasetusten sekä testien
kuvaukset kuuluvat niitä toteuttavaan työhön. Aiempi linjaus toteutuksen
rajojen säätämisestä käytön perusteella säilyy. Otsikoinnin hyväksytyt
valinnat sekä ADR 0005:n erillinen kloonivirta säilyvät.

Lähdekoodi tarkistettiin revisiosta `35dccfc49b3cae505df75a8909aec276ce009580`.
Pi-kirjautumisen käyttöliittymä ja väliaikaiset keskustelureitit olivat olemassa,
vaikka vanha sivu kuvasi ne puuttuviksi tai jätti reitit taulukosta pois.
Gatewayn sisältöä koskeva lause täsmennettiin erottamaan liikenteen välitys
lokeista ja diagnostiikasta. Hyväksyttyjen päätösten välisiä ristiriitoja ei
läpikäynnissä havaittu. Sivu ei muuta protokollaa eikä väitä live-todennusta.

Palveluvaatimukset säilyvät [asennusissuen liitteessä](../prepare-mvp-operations/service-requirements.md).
Testien vastuut ja suunnitelmat ovat ennestään toteutuskartassa ja toteutusissueissa.
Dokumentaatio- ja toteutuskartan tarkistukset sekä `git diff --check` läpäisivät.
`./scripts/ci-local.sh --clean --json` läpäisi revisiolla
`296e4a9` (`status: passed`, `clean: true`). Tämä on paikallisen portin
synteettinen testi- ja pakettinäyttö; live-palvelinta ei muutettu eikä testattu.

Jarin lukukierroksen tarkennukset: yhden kirjoittajan käyttötapa koskee myös
tuotantoa. Kaikki saapuvat viestit, kysymykset ja sisältölohkot esitetään
käyttäjälle vähintään turvallisena tekstinä; pelkkä tuntemattoman lohkon ilmoitus
ei riitä. Kysymysdialogien vastaus- ja perumisohjaus pysyy erillisenä asiana.
Nämä täsmennettiin rajapintasivulle ja agenttiohjauksen sekä keskustelun UI:n
issueihin. Rajapintasivun lukukierros valmistui ennen arkkitehtuurisivun käsittelyä.

Sanamuotocommitin `1c1e8f8` puhdas portti läpäisi uusinnalla toisen testiajon
vapautettua Playwright-portin. Viimeiset dokumentti- ja issuetarkennukset
varmennetaan dokumentaatio- ja toteutuskartan validaattoreilla, issue doctorilla
sekä `git diff --check` -tarkistuksella. Täyttä porttia ei ajeta niille uudelleen:
nykyinen `TESTING.md` rajaa nämä dokumentaatiotarkistuksiin.

## Lyhyt briefi jatkajalle

- Dokumentti palvelee omaa tehtäväänsä: ADR kertoo päätöksen ja syyn, toteutusissue
  tulevan työn. Korjaushistoria kuuluu Gitiin, ei varsinaiseen tekstiin.
- Jari ei halua säilyttää issueiden vanhoja päätösmerkintöjä sanatarkasti tai
  testikuitteja vain säilyttämisen vuoksi. Tämä tarkentaa skillin oletusta.
- Tarkat raja- ja puskuriluvut eivät ole tuotevaatimuksia. Mekanismi tarvitsee
  konkreettisen tarpeen; arvot säätyvät havaintojen mukaan eivätkä estä normaalia käyttöä.
- OAuth/OIDC-kirjaston valinta ei ole Jarin vaatimus. Toimiva ja turvallinen
  kirjautuminen on; tämä ei hyväksy nykyisiä kirjautumisongelmia.
- Riippumattomaan mallikatselmointiin Jari suosii Astraa.

## Arkkitehtuurisivun läpikäynti 2026-09-29

Jari hyväksyi rajauksen: sivu selittää käyttäjän kulun ja vastuiden syyt;
protokollan yksityiskohdat ja julkaisemisen työohjeet linkitetään niiden omiin
dokumentteihin. Hyväksyttyä arkkitehtuuria ei muuteta.

Lähteinä olivat ADR:t 0001, 0003, 0004 ja 0005, rajapintasivu, toteutuskartta
sekä gatewayn ja daemonin reitit lähtörevisiossa `174ffe8`.
Vanhentuneet väitteet kokonaan puuttuvasta ohjauksesta ja työtilakirjoituksista
poistettiin. Broker nostettiin kaavioon ja tekstiin kolmanneksi auktoriteetiksi.
Yleisen SSE:n rinnalle kuvattiin hyväksytyn kloonivirran erilainen katkokäytös.
Muut harnessit ja usean palvelimen selain erotettiin ensimmäisestä toteutuksesta.

Natiivien komponenttien perustelut, Git-integroinnin tavoite, Taskfleetin
worktree-omistajuus, yhden kirjoittajan käyttötapa ja pienten annotaatioiden
rajat säilyvät. Rajapintojen ja operoinnin yksityiskohdat löytyvät jo omista
lähteistään; uusia rinnakkaisia liitteitä ei luotu. Tuotesivun ristiriidat
jätettiin seuraavan läpikäynnin aiheeksi.

`python3 scripts/validate-project-view.py` ja `git diff --check` läpäisivät.
Issue doctorissa ei ollut skeema- tai linkkivirheitä; sen neljä aiempaa
PNG-kuvahavaintoa ovat muissa issueissa. Täyttä porttia ei ajettu uudelleen,
koska muutos koskee vain dokumentaatiota ja issuen tekstiä (`TESTING.md`).
Live-palvelinta ei muutettu eikä testattu.

## Tuotesivun läpikäynti 2026-09-29

Jari hyväksyi rajauksen: sivu kertoo tuotteen tavoitteen ja sovitun
toiminnallisen laajuuden. Hyväksytyt toiminnot säilyvät; protokollan mekanismit
ja testimatriisit korvataan linkeillä niiden nykyisiin lähteisiin. Alder ja
nimettyjen ihmisten pakolliset kokeet poistuvat yleisestä tuotekuvauksesta.

Lähteinä olivat rajapinta- ja arkkitehtuurisivut lähtörevisiossa `e78a084`,
UI-päätös 2026-09-22, Jarin `review-mvp`-issuessa 2026-09-28 tekemä
loppuportin poisto sekä 2026-09-29 täsmennetty agenttiohjauksen rajaus.
Terminaalihistoriat jäävät luettaviksi, päättyneen selainkeskustelun jatkaminen
säilyy tavoitteena ja saapuvat kysymykset näytetään ilman erillisten
dialogiohjainten toteutuslupausta. Kirjautumisen, historian ja selainohjauksen
osittainen toteutus erotetaan sovitusta tavoitteesta.

Y1–Y5- ja M1–M7-taulukoiden yksityiskohtia ei kopioitu uuteen liitteeseen:
rajapinnat, toteutuskartta ja vastuulliset issuet kantavat jo niiden sisällön.
Pilotin ehdotettu kuormituslista ja lopullinen hyväksyntäportti poistettiin
Jarin päätöksen mukaisesti. GitHub, työtilojen elinkaari, Taskfleet-worktreet,
arkistointi, keskustelukokemus ja operointi säilyvät. Navigaation nimi ja kaksi
vanhoihin otsikoihin johtanutta linkkiä päivitettiin.

`python3 scripts/validate-project-view.py` ja `git diff --check` läpäisivät.
Issue doctorissa ei ollut skeema- tai linkkivirheitä; samat neljä muiden
issueiden PNG-kuvahavaintoa säilyvät. Täyttä CI-porttia ei ajettu uudelleen,
koska muutos koskee vain dokumentaatiota (`TESTING.md`). Live-palvelinta ei
muutettu eikä testattu.
