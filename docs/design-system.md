# Design system

Yhteinen visuaalinen perusta ja nykyiset komponenttireferenssit ovat
[design-system-hakemistossa](../design-system/AGENTS.md). Siellä ylläpidetään
tokeneita, niiden käyttösääntöjä ja komponentteja. Tämä sivu opastaa kokonaisuuteen;
se ei ole toinen tokenien tai komponenttirajapintojen määrittely.

Nykyiset JSX-tiedostot ja staattiset käyttökortit ovat suunnittelureferenssejä.
Tuotannon frontend-tekniikkaa, komponenttikirjastoa tai ajettavaa katalogia ei
ole vielä valittu tai rakennettu.

## Tavoiteltu rakenne

1. Visuaalinen perusta: värit, typografia, välit, pinnat, liike ja fokus.
2. Yleiset komponentit: painikkeet, kentät, valikot, dialogit ja ilmoitukset.
3. Tuotteen komponentit: agentin tila, viestit, työkaluryhmät, diffit ja editori.

Tuotantokomponentilla on määritelty käyttöliittymä, olennaiset tilat,
saavutettava vuorovaikutus ja toimiva esimerkki. Tuote ja komponenttikatalogi
käyttävät samaa toteutusta. Verkkoyhteys ja Pi:n ohjaus ovat sovelluslogiikkaa.

[Tuotantodesign](../issues/design-production-ui/item.md) sovittaa workspace- ja
keskusteludesignin yhteen ja määrittelee tarvittavan komponenttijoukon.
[Komponenttien toteutus](../issues/build-design-system/item.md) rakentaa
ensimmäisen version valitulla tekniikalla. Seuraavat ominaisuudet kasvattavat
samaa kirjastoa todelliseen tarpeeseen.

Tälle sivulle lisätään katalogin katselulinkki ja käyttöohje, kun katalogi on
olemassa. [Käyttökulut ja näkymäkatselmointi](ui.md) kertovat, miten komponentit
liittyvät tuotteeseen.
