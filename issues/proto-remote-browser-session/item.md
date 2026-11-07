---
created: 2026-11-06
updated: 2026-11-07
type: task
reporter: jari
status: open
priority: normal
related: ['@research-remote-browser-session']
preparation: ready
lane: remote-browser-proto
lane_seq: 1
---

# Prototype: open your server browser, sign in, hand it to the agent

## Description

Jari 6.11.2026: henkilöllä on palvelimella oma selain, jonka hän avaa
etänäkymänä Habitatissa, kirjautuu sillä palveluun ja sulkee näkymän;
sen jälkeen agentti käyttää samaa kirjautunutta selainta. Rinnakkainen
arkkitehtuuriselvitys: `research-remote-browser-session`.

Prototyyppikierros (`AGENTS-WORKFLOW.md`), yksi näkymä: miten henkilö
löytää ja avaa oman palvelinselaimensa, miltä etänäkymä näyttää
(työpöytä ja puhelin), miten hän luovuttaa sen agentille ("valmis,
agentti saa jatkaa"), miten hän näkee, mitä agentti selaimessa tekee tai
teki, ja miten hän ottaa ohjauksen takaisin. Mistä agentti tietää, että
selain on kirjautunut, ja mitä keskustelussa näkyy, kun agentti tarvitsee
henkilön kirjautumaan (esim. MFA kesken työn). Kolme suuntaa, suositus,
enintään kolme kysymystä.

## Acceptance Criteria

- [x] kierros 1: kolme suuntaa, näkymätarjous ja kysymykset Jarille
- [x] kierros 2: kolme pienoiskuvan riffiä, näkymätarjous ja kysymykset Jarille

## Decision (Jari 2026-11-07, kierros 1)

Suunta **3 Pyydettäessä**: selkein, koska se antaa selaimelle eniten tilaa.
Agentin selaintyö näkyy keskustelussa pienoiskuvana, kun selain ei ole auki:
kyllä, ja sitä prototypoidaan. Kaikkien keskustelujen selainlokia ei tarvita.
Kierros 2: Pyydettäessä-suunnan riffit pienoiskuvasta ja siitä, miten
henkilö näkee, mikä keskustelu selainta käyttää (selain on henkilön oma ja
yhteinen hänen agenteilleen; yksi ohjaa kerrallaan).

## Decision (Jari 2026-11-07, kierros 2)

Riffataan: keskustelussa **siru**, josta aukeaa kierroksen 2 suunnan 2
kaltainen **palkki** (kaistale pienine kuvineen). Agentilla voi olla
**useita selainikkunoita** (Jari on nähnyt agentin avaavan muita ikkunoita
tehdäkseen jotain usealla yhtä aikaa), joten siru ja palkki kantavat useita.
**Agentin hiiren liike ei näy** kierroksen 2 kuvissa: sen pitää näkyä.
Lisäksi (Jari kysyi, näkyvätkö selaimet esim. vasemmassa palkissa;
kapellimestarin suositus kyllä): henkilön oma selain yhtenä rivinä
vasemmassa palkissa (tila, mikä keskustelu ohjaa, avaa arkin).
