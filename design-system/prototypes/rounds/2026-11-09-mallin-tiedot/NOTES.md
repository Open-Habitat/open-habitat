# Mallin tiedot – kierros 1: mitä yläpalkin mallisirun takaa aukeaa

- **A Vaihda tässä**: oikea valitsin tälle keskustelulle. Vaihto koskee seuraavaa viestiä, ja keskusteluun jää rivi "Malli vaihtui".
- **B Tietona**: pelkkä tieto ilman reunuksia: malli, ajattelutaso ja kirjautuminen; muut mallit hiljaisena tekstinä.
- **C Lyhyesti ja minne**: yksi rivi ja kaksi tietä: uusi keskustelu toisella mallilla tai uusien keskustelujen oletus.

Issue `proto-model-details-not-picker` (Kaisa 9.11.: nykyinen
ponnahdus näyttää valitsimelta, vaikka siinä ei voi valita mitään).
Tarina on kaikissa sama: keskustelu *Testikierros 9.11.* työtilassa
`open-habitat`, Claude-tilaus, Opus 5.5 ja ajattelutaso Medium, konteksti
12 % (120 000 / 1 000 000). Samalla kirjautumisella ovat Fable 5.1,
Sonnet 5.5 ja Haiku 5.5 (200 000:n konteksti, tasot Low–High). Uusien
keskustelujen oletus on Sonnet 5.5 · High. Ponnahdus on auki jokaisen
suunnan oletusnäkymässä; puhelimessa se on tuotannon alalaatikko.

A käyttää tuotannon `ModelPicker`ia (radiorivit ja ajattelutason
`Segmented`) ja vaihto tehdään erillisellä *Vaihda*-painikkeella, jonka
yllä kerrotaan seuraus. Vaihdon jälkeen ketjuun tulee tuotannon
`SessionSettingsRow` ja siru vaihtuu. Yläpalkin *Agentti työssä* näyttää
A:n estetyn tilan syineen. C:n *Uusi keskustelu toisella mallilla*
avaa tyhjän keskustelun, jossa viestikentän oma mallivalitsin on auki.
*Uusien keskustelujen oletus* näyttää kaikissa vain ilmoituksen siitä,
minne se veisi (Asetukset › Tekoäly).

`round.css` siirtää puhelimen alalaatikon kelluvan suuntavalitsimen
yläpuolelle; se on katselmointikehystä, ei ehdotus.

## Rakentaminen ja tarkistus

Aja kertakäyttöisessä checkoutissa, jossa on `web/node_modules`
commitoidusta lukosta.

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

`check.mjs`:n alussa kerrotaan kuvat ja väitteet. Viimeisin ajo: 160
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
