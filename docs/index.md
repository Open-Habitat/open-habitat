# Native Agent Host

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimen workspaceihin
ja natiiveihin AI-agentteihin. Käyttäjä säilyttää omat tiedostonsa, tunnuksensa ja
työkalunsa; samoja töitä voi jatkaa SSH:n, tmuxin ja selaimen kautta.

Aloita [tavoitteesta ja MVP:stä](product.md) ja
[katso tämänhetkinen tilanne](status.md).

## Tavoite ja eteneminen

- [Tavoite ja MVP](product.md): mitä ensimmäisellä järjestelmällä voi tehdä.
- [Vaiheistus](implementation.md): miten määrittely ja toteutus johtavat siihen.
- [Tilanne](status.md): mitä on tehty ja mikä tarvitsee seuraavaksi huomiota.

## Järjestelmä ja päätökset

- [Arkkitehtuuri](architecture.md): sovittu Unix-natiivi perusta.
- [Kriittiset oletukset](assumptions.md): mitä pitää vielä todentaa.
- [Päätökset](decisions.md): hyväksytyt ratkaisut ja seuraavat päätöstehtävät.
- [Rajapinnat](interfaces.md): komponenttien vastuut ja tarkennettava käyttäytyminen.
- [Lokituksen ehdotus](logging.md): turvalliset diagnostiikkajäljet ja Jarin päätettävät rajat.
- [Tutkimukset](evidence.md): aiempi näyttö ja sen rajoitukset.

## Käyttöliittymä

- [Käyttökulut ja katselmointi](ui.md): design-aineisto ja päätöskohdat.
- [Design system](design-system.md): yhteinen perusta ja polku oikeisiin komponentteihin.

Tarkemmat suunnitelmat, kokeet ja toteutustehtävät löytyvät sivujen linkittämistä
issueista. Osa tutkimuslinkeistä osoittaa yksityiseen GitHub-repoon ja vaatii
pääsyoikeuden. Tämä on repon dokumentaatio; Glasspad tarjoaa sille selainkatselun,
kun sen nykyinen agenttiohjetiedostojen käsittelyrajoitus on korjattu.
