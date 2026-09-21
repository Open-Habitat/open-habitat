# Kriittiset oletukset ja niiden todentaminen

Nämä kysymykset vaikuttavat siihen, mitä käyttöliittymä voi luvata ja miten
järjestelmä toteutetaan. Taulukko on ensimmäinen tutkimuslista, ei raportti
suoritetuista kokeista. Aikaisempi tutkimus on [evidence-sivulla](evidence.md).

| Tunnus ja kysymys | Tila | Miten todennetaan | Työ ja vaikutus |
|---|---|---|---|
| A1: Pi-historiasta saadaan vakaa identiteetti ja oikea workspace-yhteys. | Avoin | Oikean version disposable-istunto, natiivihistoria ja resume. | [Pi-koe](../issues/probe-pi-control/item.md); historian ja listauksen perusta. |
| A2: Pi tarjoaa tarvittavan ohjauksen ja tapahtumat, myös tuetut käyttäjäpyynnöt. | Avoin | Prompt, stream, keskeytys, kysymys sekä jonotus/steering erikseen. | [Pi-koe](../issues/probe-pi-control/item.md); rajaa keskustelun toiminnot. |
| A3: Terminaalissa aloitettuun agenttiin voi liittyä turvallisesti eikä resume monista sitä. | Avoin | Erota historia, elävä prosessi ja ohjattava yhteys; kokeile kilpailevia jatkamisyrityksiä. | [Pi-koe](../issues/probe-pi-control/item.md); voi johtaa selitettyyn vain luku -tilaan. |
| A4: Hyväksytyt GitHub-/worktree-toiminnot onnistuvat natiivien työkalujen ja Unix-käyttäjän oikeuksilla. | Avoin | Versiot, auth-raja ja disposable Git-kokeet; etämuutosten testaus sovitaan erikseen. | [Elinkaarikoe](../issues/probe-workspace-lifecycle/item.md); credential- ja osittaisten tulosten rajat. |
| A5: Arkisto, piilotus, synopsis ja vanhempikonteksti voidaan toteuttaa ilman rinnakkaista rekisteriä/historiaa. | Avoin | Selvitä natiivit tiedot ja nimeä vain puuttuvat annotaatiot sekä niiden paikka. | [Elinkaarikoe](../issues/probe-workspace-lifecycle/item.md), [rajapinnat](../issues/define-host-contracts/item.md). |
| A6: Snapshot ja tapahtumavirta voidaan sovittaa yhteen ilman hukattuja tai monistettuja viestejä. | Avoin | Määrittele cursorit/kuittaukset; testaa katkokset snapshotin, lähetyksen ja kuittauksen välissä. | [Rajapinnat](../issues/define-host-contracts/item.md), [ohjaus](../issues/build-agent-control/item.md), [häiriötestit](../issues/verify-v1-resilience/item.md). |
| A7: Gateway erottaa käyttäjät ja daemon/agentit palautuvat sovitulla tavalla. | Avoin | Kaksi testi-identiteettiä, väärä reititys, selainkatkos ja daemonin restart. | [Host-valinta](../issues/choose-host-stack/item.md), [ensimmäinen polku](../issues/build-workspace-slice/item.md), [häiriötestit](../issues/verify-v1-resilience/item.md). |
| A8: Valittu renderöinti toimii oikealla historialla, pitkällä tulosteella ja näppäimistöllä. | Avoin | Edustavat tapahtumat, pitkät historiat, päivittyvä työkalu ja fokuskoe. | [Frontend-valinta](../issues/choose-frontend-stack/item.md), [komponentit](../issues/build-design-system/item.md). |

Tuloksen yhteyteen kirjataan päivämäärä, tutkittu versio/revisio, linkki kokeen
komentoihin ja havaintoihin sekä vaikutus suunnitelmaan. Tila voi olla avoin,
osittain todennettu, todennettu tai kumottu. Mainitse aina se ympäristö ja
toimintaraja, jossa tulos pätee. Selvitysissue voi valmistua myös oletuksen
kumoutuessa; tukematon kyky ei muutu toteutetuksi merkitsemällä tehtävä valmiiksi.

[Katselmoinnin valmistelu](../issues/prepare-ui-review/item.md) kokoaa ensimmäiset
tulokset tälle sivulle. Myöhemmät toteutuspalat lisäävät järjestelmän todellisen
käyttäytymisen näytön. Avoin kriittinen oletus tarvitsee joko riittävän näytön tai
selvästi hyväksytyn toimintarajan ennen siitä riippuvaa toteutusta.
