# Polku ensimmäiseen toimivaan MVP:hen

Jari hyväksyi tämän vaiheistuksen suunnan 2026-09-21 ja pyysi valmistelemaan
polun muiden agenttien kuljettavaksi. **2026-09-28 hän poisti lopullisen MVP-
hyväksyntäportin**: tuotetta viedään eteenpäin havainto ja rajattu katselmointi
kerrallaan, ilman selkeää lopullista MVP-rajaa. Alla olevat vaiheet ovat
historiallinen suunnitelma, eivät nykyinen hyväksyntäehto. Issuectl omistaa
tehtävien ajantasaiset tilat, lanet, riippuvuudet ja ajettavuuden. Tämä
dokumentti ei ole toinen työjono.

Nykyinen [toteutuskartta](implementation-briefs.md) osoittaa toimintojen
vastuuissuet. Teknologiavalinnat hyväksyttiin 23.9.; tarkat rajapinnat ja
toteutettavien issueiden rajaukset elävät niiden omissa dokumenteissa.

## Lähtökohta ja valmistuminen

[ADR 0001](../../docs/adr-0001-unix-native-agent-host.md) määrittää Unix-natiivin
perustan. Workspace-/agenttinavigoinnin MVP-suunta on hyväksytty; keskustelun
tarkat toiminnot, Pi:n ohjausmahdollisuudet ja tuotantotekniikat tarvitsevat
vielä määrittelyn. Nykyiset JSX-komponentit ovat suunnittelureferenssejä.

**Toimiva ydin:** kirjautuminen oikealle Linux-käyttäjälle, todellisen workspacen
ja Pi-historian avaaminen, agentin käynnistys/resume, viesti, elävä vastaus sekä
katkoksesta palautuminen. Tämä osoittaa, että kaikki kerrokset toimivat yhdessä.

**Koko MVP:** lisäksi hyväksytty keskustelukokemus, workspacejen elinkaari,
GitHub-kytkentä, worktreet, arkistointi/jatkaminen, kahden käyttäjän erottelu,
asennus/päivitys/palautuminen ja Jarin käytännön katselmointi.

Työpöytä, suomenkielinen käyttöliittymä, yksi palvelin ja Pi ovat ensimmäinen
kohde. Uudet UI-laajennukset alkavat omalla designilla ja
katselmoinnilla havaittuun tarpeeseen. Mobiili, muut harnessit ja
usean palvelimen näkymä eivät aktivoidu tämän polun valmistumisesta.
Northwind ja Acme säilyvät myöhempinä käyttöönottoina, eivät Alder-MVP:n piilevinä
lisävaatimuksina.

## 1. Tavoite ja käyttökulut

@define-mvp-scope tarkentaa `docs/product.md`:n ja `docs/ui.md`:n: mitä käyttäjä
saa aikaan, miltä onnistuminen näyttää ja miten epäonnistumiset käsitellään.
Työ inventoi nykyisen designin eikä aloita korvaavaa suunnittelijatoimitusta.

Tuloksena on katselmoitava käyttökulkujen ja hyväksymisskenaarioiden kuvaus.
Jo hyväksyttyjä workspace-, GitHub-, worktree- ja arkistotoimintoja ei rajata
pois ajan säästämiseksi. Avoimet keskustelutoiminnot merkitään avoimiksi.

## 2. Kriittisten oletusten todentaminen

@probe-pi-control selvittää Pi:n todellisen discovery-, historia-, ohjaus- ja
resume-rajapinnan. @probe-workspace-lifecycle jatkaa workspacejen, Gitin,
GitHub-oikeuksien ja tarvittavien annotaatioiden rajaan.

Kokeet säilyvät omissa issuehakemistoissaan. Ne eivät muuta oikeita
käyttäjäistuntoja, tunnuksia tai remote-repoja. Havainnosta kirjataan tutkittu
versio, toistettava komento, tulos ja rajoitus. Kokeen valmistuminen ei tarkoita,
että alkuperäinen oletus olisi tosi. Todentamatta jäänyt kyky säilyy tuntemattomana.

@prepare-ui-review yhdistää käyttökulut ja kokeiden tulokset yhteisiin
dokumentteihin ja valmistelee konkreettiset päätettävät asiat.
@review-ui-v1 on tämän jälkeen Jarin kanssa käytävä katselmointi.
Sen hyväksytty tulos on tuotteen toteutettava toiminta, ei vielä tekninen stack.

## 3. Tekniset päätökset ja rajapinnat

@choose-frontend-stack vertaa rajattuja vaihtoehtoja ja kokeilee oikeita
Pi-esimerkkitapahtumia. Valinta sisältää näkymäkerroksen, reitityksen, buildin,
tilanhallinnan, saavutettavat peruskomponentit, renderöinnin ja testauksen.

@choose-host-stack tekee vastaavan ehdotuksen daemonista, gatewaysta,
autentikoinnista, prosessiomistajuudesta ja paketoinnista. Päätökset kirjataan
ehdotetuiksi ADR:iksi. Uusia ADR-numeroita varataan vasta tehtävää tehdessä.

@define-host-contracts kuvaa snapshotit, komennot, tapahtumat ja virheet sekä
niiden merkityksen: viestin hyväksyntä, epävarma lähetys, päättyneen keskustelun jatkaminen,
SSE:n toisto/resnapshot, tiedostopolut ja osittaiset epäonnistumiset.
Lähdetietojen ja uusien annotaatioiden omistajuus ratkaistaan tässä.

Tuloksena on perusteltu tekninen kokonaisuus, konkreettiset esimerkkivaihdot ja
testiskenaariot. Suunniteltua rajapintaa ei kuvata jo toteutetuksi.

## 4. Tuotantodesign ja toteutuksen perusta

@design-production-ui sovittaa kaksi design-toimitusta samaan design systemiin
ja määrittelee komponentit, käyttötilat, saavutettavuuden ja näkymien
vuorovaikutuksen. Tokenit ja komponenttien sopimukset kuuluvat `design-system/`-
hakemistoon. Tuotteen käyttökulut kuuluvat `docs/ui.md`:hen.

@plan-v1-implementation kokoaa tulokset `implementation-briefs.md`:ksi tämän
issuen alle. Jokaisella toteutuspalalla on syötteet, rajaus, tiedosto-omistus,
tarkat ehdotetut tarkistuskomennot ja valmistumisen näyttö. `review.md` kokoaa
Jarin päätettävät asiat. Komennot muuttuvat todennetuiksi vasta, kun
sovelluspohja tekee ne ajettaviksi ja suorittaa ne.

@review-implementation-plan käy tekniset päätökset ja korjatun designin Jarin
kanssa läpi. Hyväksyntä kirjataan täsmällisiin versioihin. Testiympäristön ja
Alder-pilotin deployment-valtuus käsitellään erikseen; epäselvää kohdetta tai
puuttuvaa lupaa ei päätellä toteutussuunnitelmasta.

Hyväksynnän jälkeen @build-app-foundation toteuttaa valitun sovellusrakenteen,
kehitysympäristön ja ajettavat tarkistukset. @build-design-system toteuttaa
ensimmäiset oikeat komponentit ja katalogin. Tuote ja katalogi käyttävät samaa
koodia. Kirjasto kasvaa myöhempien palojen tarpeista.

## 5. Ensimmäinen todellinen käyttökulku

@build-workspace-slice yhdistää kirjautumisen gatewayn ja daemonin kautta oikeaan
hakemistolistaan. Jo tässä testataan kaksi identiteettiä ja väärän käyttäjän
reitityksen torjuminen. @build-history-view tuo natiivihistorian luettavaksi.
@build-agent-control yhdistää käynnistyksen/resumen, viestin ja tapahtumavirran.

Tuloksena esitellään toimiva ydin oikealla, turvallisesti rajatulla testiagentilla.
Selaimen sulkeminen ei pysäytä työtä; epävarmaa viestiä ei lähetetä automaattisesti
uudelleen. Terminaalissa aloitetun agentin historia on selaimessa vain luettava.

## 6. Käyttöliittymän täydentäminen

@complete-conversation-ui viimeistelee hyväksytyn keskustelun ja navigoinnin
kokonaisuuden: työkaluryhmät, koodi/diffit, kopiointi,
keskeytys sekä sovitut jonotus-/ohjaustoiminnot. Luonnokset, fokus, lukupaikka,
pitkä historia ja kaikki olennaiset yhteys-/virhetilat todennetaan.

Tarvittavat komponentit ja niiden esimerkit kasvavat samassa kirjastossa.
Korjaukset suhteessa hyväksyttyyn designiin tehdään näkyviksi katselmointia varten.

## 7. Koko hyväksytty toiminnallisuus

@manage-workspace-lifecycle, @connect-github-workspaces,
@manage-agent-worktrees ja @archive-agent-conversations toteuttavat hyväksytyt
host-toiminnot käyttöliittymästä natiiviin operaatioon asti. Jokainen pala
todentaa onnistumisen lisäksi osittaiset epäonnistumiset ja katkokset.

Workspacejen poistaminen, agenttien pysäytys ja GitHub-operaatiot käyttävät
sovittuja valtuus- ja vahvistusrajoja. Arkisto ei ole toinen historiatietokanta.

## 8. Käyttöönotto, häiriöt ja hyväksyntä

@prepare-mvp-operations paketoi sovelluksen ja dokumentoi asennuksen,
päivityksen, palautumisen, lokit sekä natiivien tietojen säilymisen.
@verify-v1-resilience suorittaa sovitut kahden käyttäjän, katkosten,
uudelleenkäynnistysten, natiivikäytön ja koko toimintovalikoiman pilotin
valtuutetussa ympäristössä. Tuloksista syntyy katselmoitava raportti.

Tulokset käsitellään havainto ja rajattu korjaus kerrallaan. Lopullinen
@review-mvp-katselmointi on poistettu käytöstä. Uudet toiminnallisuudet
suunnitellaan ja katselmoidaan oman tarpeensa perusteella.

## Dokumentit ja agentin toimitus

| Tieto | Pysyvä paikka | Työn yksityiskohdat |
|---|---|---|
| Tavoite ja MVP | `docs/product.md` | Määrittely- ja katselmointi-issuet |
| Kriittiset oletukset | `docs/assumptions.md` | Kokeen `result.md`, versiot ja tapahtumaesimerkit |
| Arkkitehtuuri ja päätökset | `docs/architecture.md`, `docs/decisions.md`, ADR:t | Vaihtoehtojen tutkimus ja kokeet päätösissuessa |
| Rajapintojen käyttäytyminen | `docs/interfaces.md` | Sovitut koneelliset skeemat ja sopimustestit |
| Design system | `design-system/` | `docs/design-system.md` opastaa katalogiin ja sääntöihin |
| Käyttökulut | `docs/ui.md` | Alkuperäiset vedokset ja kierrosten palaute issueissa |
| Operointi | `docs/operations.md`, kun valinnat on tehty | Asennus-/pilotointinäyttö kyseisessä issuessa |
| Työ ja järjestys | Issuectl | Ei rinnakkaista TODO-jonoa |

Jokainen työntekijä tallentaa `result.md`:hen mitä muuttui, millä revisiolla ja
komennoilla se todennettiin, mikä jäi epävarmaksi ja mitä seuraava työ tarvitsee.
Päätös ei jää vain issuekommenttiin: hyväksytty ratkaisu päivitetään sen pysyvään
dokumenttiin. Dokumentaation Glasspad-näyttämisen nykyinen rajoitus ei estä
suunnittelua; tiedostot ovat katselmoitavissa repossa.

Työrupeaman käytännöt, ihmisarvioiden käsittely ja yhteisten tiedostojen rajat
ovat [AGENTS-WORKFLOW.md](../../AGENTS-WORKFLOW.md)-ohjeessa. Jos havainto muuttaa
riippuvuuksia, päivitä issuectl ensin. Älä ohita puuttuvaa näyttöä merkitsemällä
blokkeria valmiiksi tai poistamalla sitä.
