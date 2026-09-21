# Käyttöliittymän v0.1-toimitusten vastaanotto

Päivitetty 2026-09-21. Tämä sivu kertoo lyhyesti, mitä toimitettiin, mitä Jari
hyväksyi ja mikä jää myöhemmäksi. Tarkat näkymä- ja tokenmäärittelyt ovat
suunnittelijan handoffeissa, eikä niitä kopioida tähän.

## Tuotepäätös

Workspace- ja agenttinavigoinnin toimitus hyväksytään ensimmäisen funktionaalisen
MVP-version suunnaksi. Toteutuksen saa tehdä suurin piirtein vedoksen mukaiseksi;
pikselitarkka viimeistely ei saa estää ensimmäisen toimivan version rakentamista.

Jari päätti 2026-09-21:

- Ensimmäinen versio näyttää yhden palvelimen. Usean palvelimen navigointia ei
  tuoda vielä mukaan.
- Toimituksen lisäämät workspacejen luonti ja poisto, GitHub-kytkentä,
  workspace-asetukset, worktree-toiminnot ja arkisto ovat tärkeitä MVP-toimintoja.
- Vedoksen automaattiset sivuvaikutukset hyväksytään: esimerkiksi luotu workspace
  tai worktree voi käynnistää agentin ja siirtää fokuksen keskusteluun.
- Agenttilista hyväksytään ensimmäiseen funktionaaliseen versioon nykyisessä
  muodossaan. Tilan erottuvuutta voidaan parantaa ensimmäisen version jälkeen,
  esimerkiksi koko agenttirivin taustavärillä. Ratkaisu tarkistetaan silloin myös
  saavutettavuuden kannalta, eikä tieto saa jäädä vain värin varaan.
- Design systemiä ei muuteta tämän vastaanoton yhteydessä.

Tämä hyväksyntä koskee tuotteen toimintojen ja näkymärakenteen suuntaa. Vedos ei
vielä todista, että Pi, daemon tai GitHub-adapteri tarjoaa kaikki tarvittavat
rajapinnat.

## Vastaanotetut aineistot

### Keskustelu

- Lähde: Hauiksen `/Users/maintainer/Downloads/Suunnittelusuunta arviointiin.zip`
- SHA-256: `a517af7bab5261a9e51c5c8df21da37d74c25fe9bb9816d74d4d232dd8f62744`
- Vedokset: [`design/vedokset/`](design/vedokset/)
- Yhteiset tokenit ja komponentit: [`../../design-system/`](../../design-system/)

Keskustelutoimituksessa ovat B1–B10, B12 ja B5a–B5f. B11 on rajattu pois.
Viestijono, kesken vuoron ohjaus ja muut Pi-rajapinnasta riippuvat ehdotukset
ratkaistaan adapterikokeen ja yhteisen UI-katselmoinnin yhteydessä.

### Workspacet ja agenttinavigointi

- Lähde: Hauiksen
  `/Users/maintainer/Downloads/Palvelimet ja workspace-dokumentaatio.zip`
- SHA-256: `598a9b7e31edf7f67078d60258050ccdb4a85014e4a1f62e4d8f8a49eb871813`
- Agenttien handoff ja näkymämäärittely:
  [`design/workspaces/AGENTS.md`](design/workspaces/AGENTS.md)
- Päävedos:
  [`design/workspaces/Agenttilista vasemmalla.dc.html`](design/workspaces/Agenttilista%20vasemmalla.dc.html)
- A1–A9-yhteenveto:
  [`design/workspaces/Yhteenveto A1-A9.dc.html`](design/workspaces/Yhteenveto%20A1-A9.dc.html)

Zipit testattiin ehjiksi, mutta niitä ei säilytetä repossa. Päävedos ja
`support.js` säilyvät muuttamattomina. Toimituksen `README.md`:n sisältö purettiin
projektikäytännön mukaisesti saman hakemiston `AGENTS.md`:ksi, ja yhteenvedon
sisäinen handoff-polku päivitettiin vastaamaan uutta nimeä. Repossa ei käytetä
alihakemistojen README-tiedostoja.

## Ei-estävä puute toimituksessa

A1–A9-yhteenveto linkittää vanhaan `Palvelimet ja workspacet.dc.html` -vedokseen,
jota zipissä ei ole. Tämä ei estä työtä: uudempi päävedos, yhteenveto ja täydellinen
handoff ovat mukana. Rikkinäinen linkki säilyy alkuperäisessä toimituksessa, jotta
vastaanotettua aineistoa ei muuteta jälkikäteen.

## Toteutuksessa todennettavat asiat

Ennen kuin vedoksen toiminnot kytketään oikeaan taustaan, Pi-kokeen ja
ensimmäisten toteutuspalojen pitää selvittää:

- havaitun agentin tila ja selaimesta ohjattavuus erillisinä tietoina;
- jo terminaalissa käynnissä olevan agentin ohjaus;
- start-, resume-, stop- ja arkistointitoiminnot natiivihistoriaa rikkomatta;
- execution root-, Git-, tmux- ja Taskfleet-tietojen saatavuus;
- GitHub-kytkennän credential- ja käyttöoikeusraja;
- luonnosten ja viimeksi saadun tilan säilyminen katkoksissa.

Agent Host ei saa toteuttaa rinnakkaista keskusteluhistoriaa, workspace-rekisteriä
tai omaa arkistotietokantaa vain siksi, että vedoksessa on niitä käyttävä näkymä.
Toiminnot sovitetaan natiivien komponenttien omistamaan tilaan.

## Seuraava katselmointi

`review-ui-v1` käy kirjautumisen, workspace-listan, agentin valinnan,
keskustelun, käyttäjäpyynnön, katkoksen ja vain luettavan agentin yhtenä polkuna
läpi. Sen tehtävä on tarkentaa ensimmäiset toteutuspalat, ei avata uudelleen tässä
kirjattua yleistä MVP-suuntaa ilman toteutuksesta löytyvää estettä.
