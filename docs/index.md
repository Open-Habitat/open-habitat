# Native Agent Host

Native Agent Host tuo selaimen käyttöliittymäksi Linux-palvelimen työtiloihin
ja natiiveihin AI-agentteihin. Jokainen käyttäjä työskentelee omalla
Unix-tunnuksellaan. Tiedostot, tunnukset ja keskusteluhistoriat pysyvät
natiivien työkalujen hallussa, ja SSH- ja tmux-käyttö säilyvät selaimen rinnalla.

## Mitä tuote tekee

[Tavoite ja toiminnot](product.md) kertoo, mitä käyttäjän on tarkoitus saada
aikaan. [Käyttökulut](ui.md) kuvaa keskustelun, navigoinnin ja toiminnan
katkoissa. [Design system](design-system.md) johtaa yhteiseen ulkoasuun ja
tuotantokomponentteihin. Nämä sivut kuvaavat sovittua tavoitetta, jonka
toteutus on osin kesken.

## Miten järjestelmä toimii

[Arkkitehtuuri](architecture/index.md) kuvaa järjestelmän sellaisena kuin se
nyt on, englanniksi: komponentit ja niiden valtuudet, kirjautuminen ja
luottamusrajat, keskustelut, tapahtumavirta ja katkoista palautuminen, työtilat,
HTTP-rajapinta sekä asennus. Jokainen sivu alkaa siitä, mitä tapahtuu, ja
sisältää kaavion.

[Päätökset](decisions/index.md) kokoaa arkkitehtuuripäätösten tallenteet.
Ne kertovat, miksi asiat ovat näin; nykytilan kertoo arkkitehtuuri.

## Missä työ on

Työn tilanne on [TODO.md](../TODO.md)-tiedostossa ja issueissa. Dokumentaatio
ei seuraa etenemistä.
