# Tavoite ja ensimmäinen MVP

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimella oleviin
projekteihin ja AI-agentteihin. Käyttäjä voi jatkaa samoissa hakemistoissa ja
keskusteluissa myös SSH:n, tmuxin ja natiivin agentin kautta. Selaimen sulkeminen
ei saa pysäyttää agenttia.

Ensimmäinen kohde on Alder, Pi ja työpöytäselaimella työskentelevät Jari ja
Kaisa omilla Linux-tunnuksillaan. Yksi palvelin riittää käyttöliittymään.
Arkkitehtuurin lähtökohta on [sovittu Unix-natiivi malli](architecture.md).

## Kaksi näkyvää valmistumispistettä

**Toimiva ydin:** käyttäjä kirjautuu sisään, avaa oikean workspacen ja sen
Pi-historian, käynnistää tai jatkaa agenttia, lähettää viestin ja seuraa vastausta.
Yhteyskatkon jälkeen näkymä palautuu oikeaan tilaan.

**Koko MVP:** käyttäjä pystyy myös luomaan ja hallitsemaan workspaceja,
käyttämään sovittuja GitHub-toimintoja, luomaan worktreen agentille sekä
lopettamaan, arkistoimaan ja jatkamaan keskusteluja. Keskustelun työkalutulokset,
koodi, sovitut diffit ja tuetut käyttäjäpyynnöt ovat luettavia ja käytettäviä.
Kahden käyttäjän erottelu ja asennus/päivitys/palautuminen on todennettu, ja
Jari on katselmoinut järjestelmän käytännössä.

## Sovittu suunta ja tarkennettavat asiat

Workspace- ja agenttinavigointi sekä workspacejen luonti/poisto, asetukset,
GitHub-kytkentä, worktreet ja arkisto on hyväksytty MVP:n suunnaksi. Luonti voi
käynnistää agentin ja siirtää fokuksen sen keskusteluun. Näiden teknistä
toteutusta ja osittaisten epäonnistumisten käsittelyä ei ole vielä määritelty.

Keskustelun jonotus, kesken vuoron ohjaus ja terminaalissa aloitetun agentin
ohjaus riippuvat vielä Pi:n todennetuista kyvyistä ja katselmoinnista.
Historiasta löytyminen, prosessin käynnissäolo ja ohjattavuus ovat eri asioita.
Käyttöliittymä näyttää puuttuvan tai vanhentuneen tiedon rehellisesti.

[Käyttökulkujen määrittely](../issues/define-mvp-scope/item.md) tarkentaa tämän
sivun onnistumis- ja häiriöskenaariot. [UI-katselmointi](../issues/review-ui-v1/item.md)
vahvistaa toteutettavan käyttökokemuksen. Tämän sivun nykyinen kuvaus kokoaa
hyväksytyn suunnan; se ei väitä kaikkia yksityiskohtia päätetyiksi.

## Ensimmäisen version ulkopuolella

Mobiili, usean palvelimen navigointi, muut harnessit, prosessikeskus ja laajemmat
editori-/työkalunäkymät odottavat erillistä valintaa. Northwindin ja Acmen
sovelluskohtaiset käyttöönotot säilyvät myöhempinä tavoitteina.

Katso [vaiheistus](implementation.md), [avoimet oletukset](assumptions.md) ja
[käyttöliittymän suunnittelu](ui.md).
