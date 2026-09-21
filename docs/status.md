# Projektin tilanne

**Updated:** 2026-09-21
**Source revision:** `642bd26c7f68009c8c59f284aca04f169ed97598`

## Sovittu perusta

Unix-natiivi arkkitehtuuri on hyväksytty. Keskustelu- ja workspace-designit
on vastaanotettu. Workspace-/agenttinavigointi sekä workspacejen elinkaari,
GitHub-kytkentä, worktreet ja arkisto kuuluvat ensimmäisen MVP:n suuntaan.
Ensimmäinen käyttöliittymä tehdään työpöytäselaimelle, yhdelle palvelimelle ja Pi:lle.

Tuotetta, tuotantokomponenttikirjastoa tai sen ajettavaa katalogia ei ole vielä
rakennettu. Frontend/backend-tekniikka, autentikointi ja tarkat rajapinnat ovat
vielä päätettäviä. Vanha benchmark-fixture ei todista niiden toimivuutta.

## Polku on valmisteltu

[Vaiheistus](implementation.md) kulkee käyttökuluista ja natiivien kykyjen
kokeista teknisiin päätöksiin, tuotantodesigniin, toimivaan ytimeen ja koko MVP:n
pilottiin. Tehtävät ja riippuvuudet on kuvattu issuectl:ssä.

Seuraava työrupeama valmistelee käyttökulut ja aloittaa Pi:n ohjausmahdollisuuksien
kokeen. Se ei aloita tuotantototeutusta. Tämän polun valmistelu ei käynnistänyt
Taskfleet-ajoja.

## Katselmoi seuraavaksi

Ensimmäinen katselmointi on [yhteinen käyttöliittymäpolku](../issues/review-ui-v1/item.md).
Sen valmistelija kokoaa designit, käyttökulut ja natiivikokeiden tulokset ennen
päätöspyyntöä. Valmis katselmointipaketti ja tarkka päätettävä asia tuodaan tähän,
kun ne ovat olemassa. Nykyisiä avoimia kysymyksiä voi seurata
[oletussivulta](assumptions.md).

Sen jälkeen katselmoidaan tekniset päätökset ja tuotantodesign, ja lopulta oikea
MVP pilotin tuloksineen. [Katselmointisivu](ui.md) linkittää näihin tehtäviin.
Valmistelu ja toimitus eivät tarkoita Jarin hyväksyntää.

## Dokumentaation katselu

Dokumentaatio on suoraan `docs/`-hakemistossa ja sen aloitus on `index.md`.
Glasspadin nykyversio hylkää hakemiston AGENTS.md/CLAUDE.md-ohjeet. Siksi
suora näyttäminen tarvitsee Glasspad-korjauksen; dokumentaation rakennetta ei
muuteta sen vuoksi. Nämä muutokset eivät vielä ole Glasspadissa julkaistuja.
