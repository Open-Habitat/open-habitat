---
title: Kokeile
description: Mitä Open Habitat -asennus tarvitsee ja miten se nyt etenee.
---

**Tila: esijulkaisu.** Open Habitat on käytössä monen ihmisen asennuksissa,
mutta julkista julkaisua ei vielä ole. Formaatit ja rajapinnat muuttuvat vielä
julkaisujen välillä ilman siirtokoodia, ja asennus olettaa vielä ylläpitäjien
apua. Lyhyt polku tavalliselle VPS:lle on tarkoitus tehdä ennen julkistusta.

## Mitä tarvitset

- Linux-palvelimen, jota ylläpidät: Ubuntu 24.04 LTS ja systemd, amd64 tai
  arm64, ja `/home` ext4-tiedostojärjestelmällä.
- Palvelimelle DNS-nimen, HTTPS-varmenteet sekä sen edessä olevan
  ingressin tai palomuurin.
- GitHub OAuth -sovelluksen kirjautumista varten.
- Jokaiselle oman mallipalveluntarjoajan tilin (esimerkiksi ChatGPT- tai
  Claude-tilauksen tai API-avaimen), ellei palvelin tarjoa AI-avainta.

## Miten asennus etenee

1. **Hae julkaisu.** Julkaisu on GitHub-julkaisu, jossa on tuotepaketti ja
   runtime-julkaisu kullekin arkkitehtuurille. Latausten SHA-256-tiivisteet
   tarkistetaan GitHubin ilmoittamia vasten ennen kuin mitään ajetaan
   rootina. Palvelimella ei tarvita lähdekoodia, Go:ta eikä npm:ää.
2. **Valitse tallennustila.** Joko käyttäjäkohtaiset rajat erillisellä
   ext4-`/home`-levyllä kiintiöineen tai ei rajoja, jolloin kaikki jakavat
   saman levyn. Valinta kuuluu asennukseen, eikä sitä voi myöhemmin vaihtaa.
3. **Kirjoita yksi sivustotiedosto.** `/etc/open-habitat/site.json` kertoo
   kotitiedostojärjestelmän, tunnusalueet, kuka saa kirjautua ja kuka
   ylläpitää, tallennustilan ja asennettavan runtimen. Salaisuudet pysyvät
   erillisissä suojatuissa tiedostoissa.
4. **Tarkista, suunnittele ja asenna.** `open-habitat host` -komennot
   tarkistavat palvelimen, palauttavat suunnitelman ja toteuttavat täsmälleen
   sen suunnitelman, jonka hyväksyit:

   ```sh
   ./bin/open-habitat host check --site /etc/open-habitat/site.json
   ./bin/open-habitat host plan  --site /etc/open-habitat/site.json --json
   ./bin/open-habitat host apply --site /etc/open-habitat/site.json \
     --approved-plan <apply-plan-id> --output=jsonl
   ```

   Ensimmäinen asennus ajaa myös `host prepare` -vaiheen, erillisen
   huoltotoimen, jonka ylläpito-opas kuvaa.

5. **Kirjaudu.** Ensimmäinen hyväksytty ihminen kirjautuu GitHubilla. Broker
   luo hänelle Unix-tunnuksen, ja aloitus opastaa repojen ja AI-tilin
   yhdistämisen läpi.

[Ylläpito-oppaassa](/fi/docs/operations/) (englanniksi) on jokainen vaihe,
myös valmistelu, päivitykset, integraatiot ja palautus.
