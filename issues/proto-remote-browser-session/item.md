---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
related: ['@research-remote-browser-session']
preparation: pending
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
