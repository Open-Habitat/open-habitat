# Käyttöliittymä ja katselmointi

Käyttöliittymän pääpolku yhdistää kirjautumisen, yhden palvelimen workspacet,
agentin valinnan ja keskustelun. Ensimmäinen versio suunnitellaan
työpöytäselaimelle ja sen käyttöliittymätekstit ovat suomeksi.

Workspace-/agenttinavigointi on hyväksytty MVP:n suunnaksi. Keskustelun
yksityiskohdat ja Pi:stä riippuvat toiminnot tarvitsevat vielä yhteisen
katselmoinnin. Vedosten data ja taustatoiminnot ovat simuloituja.

## Katselmoinnin aineisto

- [Vastaanotto ja jo tehdyt päätökset](../issues/receive-designer-v1/review.md).
- [Keskustelutoimitus](../issues/receive-designer-v1/design/AGENTS.md).
- [Workspace- ja navigointitoimitus](../issues/receive-designer-v1/design/workspaces/AGENTS.md).
- [Yhteinen design system](design-system.md).

[Käyttökulkujen määrittely](../issues/define-mvp-scope/item.md) ja
[yhteisen katselmoinnin valmistelu](../issues/prepare-ui-review/item.md) tekevät
näistä yhden katselmoitavan polun. Niiden on ratkaistava tai nostettava näkyviin
erityisesti jonotus/steering, agentin ohjattavuus, kysymykseen vastaaminen,
luonnokset, fokus, lukupaikka, otsikointi ja toisen agentin huomiotarve.

## Kolme katselmointia

| Kohta | Katselmoitava asia | Kirjaus |
|---|---|---|
| [Käyttökokemus](../issues/review-ui-v1/item.md) | Yhteinen polku sekä todennettujen kykyjen vaikutukset designiin. | Hyväksytty toiminta ja tarvittavat korjaukset. |
| [Toteutusvalmius](../issues/review-implementation-plan/item.md) | Teknologiavalinnat, rajapinnat, tuotantodesign ja toteutuspalat. | Päätökset ja niiden kohteena olevat versiot. |
| [Koko MVP](../issues/review-mvp/item.md) | Oikea sovellus, pilotin tulokset ja jäljellä olevat puutteet. | Jarin käytännön hyväksyntä tai korjaustarpeet. |

Katselmointien ajantasainen valmius määräytyy issueiden riippuvuuksista.
Valmistelija tuo linkit ja suosituksen; hyväksyntää ei päätellä toimituksesta.
Toimivan ytimen demo on näiden välissä näkyvä välitulos. Jokaisesta kierroksesta
kirjataan, mitä versiota katselmoitiin ja mikä muuttui palautteen perusteella.
