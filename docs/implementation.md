# Vaiheet toimivaan järjestelmään

Tavoitteena on ensin oikealla Pi-agentilla toimiva ydin ja sen jälkeen koko
[hyväksytty MVP](product.md). Vaiheistus ja tekniset valinnat hyväksyttiin
[`review-implementation-plan`](../issues/review-implementation-plan/review.md)-katselmoinnissa revision `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`
mukaisina. [Toteutuspaketti](../issues/plan-v1-implementation/implementation-briefs.md)
rajaa jokaisen työn tuotoksen, omistajuuden, testit, palautumisen ja alustavat
komennot. Issuectl yksin määrää ajettavuuden ja järjestyksen.

| Vaihe | Tulos, jota voi katselmoida tai kokeilla |
|---|---|
| 1. Tavoite ja käyttökulut | Yhteinen kuvaus onnistumisesta, virhetilanteista ja MVP:n rajasta. |
| 2. Kriittisten oletusten kokeet | Todennettu kuva Pi:n sekä workspace-/GitHub-/worktree-toimintojen kyvyistä ja rajoista. |
| 3. Tekniset päätökset ja rajapinnat | Perustellut stack-ehdotukset, komponenttien vastuut sekä viestien ja virheiden sopimukset. |
| 4. Tuotantodesign ja perusta | Katselmoitu design system, valittu tekniikka, ajettava sovelluspohja sekä oikeat komponentit katalogeineen. |
| 5. Toimiva ydin | Kirjautuminen → workspace → natiivihistoria → agentin ohjaus → streamaus → katkoksesta palautuminen. |
| 6. Käyttöliittymän täydentäminen | Hyväksytty keskustelu ja navigointi: työkalut, diffit, käyttäjäpyynnöt sekä olennaiset vuorovaikutus- ja virhetilat. |
| 7. Koko MVP:n toiminnot | Workspacejen elinkaari, GitHub, worktreet, arkisto ja jatkaminen. |
| 8. Operointi ja pilotti | Asennus/päivitys/palautuminen, kahden käyttäjän erottelu, todelliset käyttökokeet ja Jarin hyväksyntä. |

Käyttökulkujen valmistelu ja natiivien kykyjen kokeet voivat edetä rinnakkain.
Tuotantototeutus alkaa, kun sitä ohjaavat päätökset, rajapinnat ja design on
katselmoitu. Jokainen toteutuspala yhdistää tarvittavan käyttöliittymän ja
natiivin toiminnan; koko backendia ja koko frontendia ei rakenneta irrallisina
ennen ensimmäistä yhteistä käyttökulkua. Kirjautuminen ja vain luettava
workspace-navigointi kulkevat nyt tuotanto-Reactista Go-gatewayn ja
käyttäjädaemonin tilannekuvaan. [Selain- ja VM-näyttö](../issues/build-workspace-slice/result.md)
on koottu erikseen; Jarin katselmointipäätös on vielä tekemättä.

Kahden käyttäjän reititys tarkistetaan ensimmäisestä autentikoidusta palasta
alkaen. Katkokset tarkistetaan ensimmäisestä elävästä keskustelusta lähtien.
Kävely-ydin säilyy järjestyksessä sovelluspohja → design system → autentikoitu
kahden käyttäjän workspace → natiivi Pi-historia → Pi-ohjaus. Sen jälkeen
rakennetaan koko keskustelu ja kaikki hyväksytyt workspace-, GitHub-, Taskfleet-
ja arkistotoiminnot. Lopun pilotti kokoaa näytön koko järjestelmästä ja sen
käyttöönotosta.

Sovelluspohja tekee ensimmäisenä lukitut Go- ja `web/`-rakenteet, TypeScript 7/Biome -formatointi- ja lint-gatet, `tsc --noEmit` -typecheckin sekä yksikkö-, integraatio-, selain-, saavutettavuus-, sopimus-, paketointi- ja bare-CI-tarkistukset ajettaviksi. Myöhemmät workerit
eivät saa nojata ehdotettuun komentoon ennen kuin tämä työ on suorittanut sen
puhtaasta checkoutista ja kirjannut sen root/local `AGENTS.md` -ohjeisiin.

## Hyväksytty hostin toteutus- ja operointiraja

[ADR 0003](adr-0003-host-stack.md) valitsee yhden lukitun Go-koodipohjan ja
julkaisubinaarin gatewaylle ja käyttäjädaemoneille. Systemd käynnistää gatewayn
omalla rajatulla tunnuksellaan ja jokaisen daemonin oikealla käyttäjätunnuksella.
Gateway reitittää ennalta määrättyyn käyttäjäkohtaiseen Unix-socketiin, ja
daemon tarkistaa gatewayn UID:n Linuxin peer credential -tiedosta. Staattinen
React-buildi toimitetaan samassa versionoidussa julkaisussa; Nodea ei ajeta
tuotantopalveluna.

Ensimmäinen toteutettava läpileikkaus tarvitsee ennen Aldera disposable-systemd-
VM:n, jossa kaksi synteettistä käyttäjää todistaa sekä oikeat reitit että väärän
käyttäjän, väärän peer UID:n, selainotsakkeella tehdyn identiteettihuijauksen,
katkoksen ja daemon-restartin torjunnat. Selain- tai gateway-katkos ei saa
pysäyttää Pi:tä. Daemonin kuolema saa pysäyttää sen omistaman Pi-lapsen, mutta
natiivihistorian pitää säilyä ja resumen olla mahdollista vasta vanhan kirjoittajan
poistumisen ja historian asettumisen jälkeen. Terminaali-TUI pysyy vain luettavana,
ja Taskfleet purkaa itse luomansa worktreet.

Jokainen käyttäjälle näkyvä slice jää `testing`-tilaan, kunnes sen Markdown-acceptance-raportti sisältää deterministic happy/unhappy Playwright-testit, olennaiset screenshotit, revision, ympäristön ja komennot ja Jari on eksplisiittisesti hyväksynyt sen. Serial lane estää seuraavan slicen siihen asti; worker ei hyväksy omaa UI:taan.

Aldern pysyvä asennus ei synny paikallisesta source-buildista tai käsin kopioidusta
unitista. Alderlla ei ollut 2026-09-22 `kaisa`-Unix-tunnusta, joten katselmointi
hyväksyy ensin sen tarkan Fleetrepo-deklaraation tai pilotti ei käynnisty. Fleetrepoen
lisätään lisäksi katselmoitu fleet-komponentti, joka omistaa tarkan julkaisuversion
ja checksumin, gateway-käyttäjän, unitit, kaksi sallittua daemon-socketia,
GitHubin numeerisen identiteettimappauksen, salatun provider-syötteen ja Tailscale HTTPS -reitin. Ennen päivitystä tai rollbackia maintenance-preflightin pitää todistaa,
ettei daemonien omistamia aktiivisia Pi-kirjoittajia ole. Aktivoinnin jälkeen
varmistetaan version JSON, konfiguraatio, unitit, health/readiness, kummankin
käyttäjän oma luku, ristiinkäytön torjunta, SSE-paluu ja yksi disposable Pi-vuoro.
Tarkat alustavat build-, Fleetrepo apply-, health-, update- ja rollback-komennot
sekä VM-/pilottifixturet ovat ADR:ssä ja
[toteutuspaketissa](../issues/plan-v1-implementation/implementation-briefs.md).
Ne muuttuvat käyttöohjeiksi vasta, kun toteutus todentaa ne. Alder on tämän jälkeen jo valtuutettu testikohde, mutta
pysyvät käyttäjät, gateway-tili, julkaisut, paketit, unitit/socketit, mappaukset,
salattu provider-auth-syöte ja Tailscale-reitti toteutetaan aina erillisessä, katselmoidussa
Fleetrepo-issuen worktreessä ja konvergoidaan Fleetrepon fleet-rajapinnalla.

[Agenttien yksityiskohtainen suunnitelma](../issues/plan-v1-implementation/plan.md)
kuvaa kunkin vaiheen tehtävät, tulokset ja omistajat. Ajantasaiset työtilat ja
riippuvuudet ovat issuectl:ssä, eivät tässä vaihetaulukossa.
[Katselmointisivu](ui.md) kertoo Jarin päätöskohdista ja
[tilannesivu](status.md) siitä, mitä on oikeasti tehty.
