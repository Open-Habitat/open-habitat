# Native Agent Host

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimen työtiloihin
ja natiiveihin AI-agentteihin. Jokainen käyttäjä työskentelee omalla
Unix-tunnuksellaan. Tiedostot, tunnukset ja keskusteluhistoriat pysyvät
natiivien työkalujen hallussa, ja SSH- ja tmux-käyttö säilyvät selaimen rinnalla.

## Aloita tästä

[Tavoite ja toiminnot](product.md) kertoo, mitä käyttäjän on tarkoitus saada
aikaan. [Käyttökulut](ui.md) kuvaa keskustelun, navigoinnin ja toiminnan
katkoissa. Sivut kuvaavat sovittua tavoitetta, jonka toteutus on vielä kesken.

[Arkkitehtuuri](architecture.md) selittää järjestelmän osat ja vastuut.
[Päätökset](decisions.md) kokoaa hyväksytyt ratkaisut perusteluineen sekä
avoimet ehdotukset. [Toteutuksen työnjako](implementation.md) näyttää,
miten toiminnot rakentuvat yhteisen perustan varaan ja mistä niiden työt löytyvät.

[Tilanne](status.md) on päivätty kuvaus toteutuksesta ja sen näytöstä.
Tarkista sivun päivämäärä ja lähderevisio: sen jälkeen tehty työ näkyy
vastuullisissa issueissa.

## Tarkemmat kuvaukset

- [Keskustelun tiedon kulku](conversation-data-flow.md): natiivihistorian, tapahtumavirran ja selaimen muisti-ikkunoiden toteutussuunnitelma.
- [Rajapinnat](interfaces.md): nykyiset reitit, sovittu tuleva käyttäytyminen ja tietojen omistajuus.
- [Daemonien sidonnat](daemon-bindings.md): käyttäjäkohtaiset asetukset ja niiden hakemistopolun suojaus.
- [Pi-runtime](pi-runtime.md): rootin asentaman Node/Pi-julkaisun valinta käyttäjädaemonille.
- [Design system](design-system.md): yhteinen ulkoasu ja tuotantokomponentit.
- [Lokituksen ehdotus](logging.md): diagnostiikan ehdotettu käytäntö ja avoimet valinnat.

## Näyttö ja avoimet kysymykset

[Todennettava näyttö](assumptions.md) kertoo, mitä ratkaisuista pitää vielä
osoittaa ja mitä kokeet ovat jo selvittäneet.
[Tutkimukset](evidence.md) johtaa aikaisempiin kokeisiin ja niiden rajoituksiin.
Tarkemmat suunnitelmat, toteutustehtävät ja tulokset löytyvät sivujen
linkittämistä issueista. Osa tutkimuslinkeistä vaatii pääsyn yksityiseen
GitHub-repoon.
