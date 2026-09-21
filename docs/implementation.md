# Vaiheet toimivaan järjestelmään

Tavoitteena on ensin oikealla Pi-agentilla toimiva ydin ja sen jälkeen koko
[hyväksytty MVP](product.md). Vaiheistus on hyväksytty suunnaksi; tekniset
valinnat ja toteutus ovat vielä edessä.

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
ennen ensimmäistä yhteistä käyttökulkua.

Kahden käyttäjän reititys tarkistetaan ensimmäisestä autentikoidusta palasta
alkaen. Katkokset tarkistetaan ensimmäisestä elävästä keskustelusta lähtien.
Lopun pilotti kokoaa näytön koko järjestelmästä ja sen käyttöönotosta.

[Agenttien yksityiskohtainen suunnitelma](../issues/plan-v1-implementation/plan.md)
kuvaa kunkin vaiheen tehtävät, tulokset ja omistajat. Ajantasaiset työtilat ja
riippuvuudet ovat issuectl:ssä, eivät tässä vaihetaulukossa.
[Katselmointisivu](ui.md) kertoo Jarin päätöskohdista ja
[tilannesivu](status.md) siitä, mitä on oikeasti tehty.
