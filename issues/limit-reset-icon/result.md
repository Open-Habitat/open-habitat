# Tulos

Jaettu `LimitReset` (`web/src/components/ServerSection.tsx`) ympäröi nyt
henkilön säätimen ja piirtää sen oikealle puolelle hiljaisen
`restore`-kuvakepainikkeen, kun henkilöllä on oma raja, ja yhtä leveän tyhjän
tilan, kun ei ole. Levytila ja Keskustelut antavat säätimensä sille lapsena;
`PeopleRow`in `end`-paikkaa ei enää käytetä palautukseen. Vihje on
*Palauta oletukseen (20 GiB)* / *Reset to default (20 GiB)*, Keskusteluissa
*(4 keskustelua)* / *(4 conversations)*.

Mittaus (`evidence/shoot.mjs` kierroksen `oletukseen-paikka` Nyt-suunnan
läpi, joka käyttää tuotannon osioita sellaisinaan): Levytila 92 px ja
Keskustelut 56 px joka rivillä 440 px:n paneelissa ja puhelimessa, 720 px:n
paneelissa molemmat 56 px; viimeinen rivi on 1 px matalampi, koska sillä ei
ole alareunaa. Säätimien oikeat reunat ovat linjassa, myös ainon palautuksen
jälkeen. Kuvat `evidence/<vaihe>-<leveys>-<teema>.avif`, kerroin 2;
`1-vihje-*` näyttää vihjeen.

## Decisions for later review

- **Henkilön nimi saavutettavassa nimessä.** Vihje on *Palauta oletukseen
  (20 GiB)*, mutta saavutettava nimi on *Palauta oletukseen (20 GiB): aino*,
  koska listan jokainen ohjain nimeää henkilönsä (säädin: *Raja: aino*);
  ilman nimeä ruudunlukija kuulisi kuusi samannimistä painiketta.
  Vaihtoehto: täsmälleen sama teksti kummassakin.
- **Keskustelujen oletus yksikön kanssa** (*4 keskustelua*), ei pelkkä
  luku, jotta vihje on ymmärrettävä yksinään.
- **Keskustelujen palautus on pois käytöstä ilman CSRF-tunnistetta**, kuten
  säädin ja Levytilan palautus; aiemmin se puuttui vain siltä.
- **Ei palautusta, kun käyttäjäkohtaiset rajat eivät ole käytössä.** Silloin
  rivillä lukee *Ei rajaa* eikä oletusrajaa näytetä, joten palautus
  oletukseen ei tarkoittaisi mitään näkyvää; aiemmin `end`-paikka näytti sen
  silloinkin, jos isännän raja erosi oletuksesta.
