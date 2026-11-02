# Otsakkeen toinen rivi — kolme suuntaa

Avaa `otsakkeen-toinen-rivi.html`. Alareunan valitsimesta vaihdat suuntaa
(näppäimet 1–4), yläreunasta laitteen (puhelin 390, puhelin 360, työpöytä
1440), teeman ja tilanteen: **Uusi keskustelu** on sinun kuvasi tilanne,
**Käynnissä** sama keskustelu ensimmäisen viestin jälkeen. ⋯ avaa valikon.

Näkymä on tuotannon sivu sellaisenaan: synteettisestä labrasta tallennettu
keskustelu tuotannon tyylitiedostolla ja fonteilla, ja suunnat muuttavat
vain otsakkeen rivejä. Labran tuntematon malli on vaihdettu kuvasi
”Opus 5.5 · Medium” -tekstiin.

## Suunnat

1. **Yksi ikonirytmi.** Toisen rivin tila on tavallisia ikoneita lukuineen,
   sama 40 px korkeus ja väli kuin ensimmäisen rivin ikoneilla; ei reunuksia.
2. **Tasakokoiset sirut.** Jokainen tila on samanlainen reunustettu siru;
   toiminta saa sanan (”Odottaa sinua”).
3. **Yksi rivi.** Toista riviä ei ole: tilapiste otsikon eteen, Git ja
   konteksti ⋯-valikon Tila-osioon, malli aina viestikentän sirussa.

**Nyt** on tuotanto tänään vertailuksi.

Kaikissa kolmessa:

- Uudessa keskustelussa malli näkyy vain viestikentän sirussa. Otsakkeen
  kopio poistuu.
- Harmaa H↻-laatikko poistuu toiselta riviltä. Se oli *Luo uusi otsikko*
  -painike, joka on uudessa keskustelussa pois käytöstä. Pois käytöstä
  olevan painikkeen ympärille tulee vihjeen kääre, jota puhelimen
  piilotussääntö ei tunnista, joten painike putosi riville laatikkona. Sama
  laatikko näkyy työpöydällä. Toiminto on edelleen ⋯-valikossa syineen.
- Käynnissä olevassa keskustelussa otsakkeen mallisiru on ainoa
  mallinvalitsin, joten suunnat 1 ja 2 pitävät sen rivillä. Suunta 3 siirtää
  sen viestikenttään.

## Mitä katsoa

- 390 vaalea, Uusi keskustelu: näkyykö toinen rivi yhtenä joukkona (1 ja 2)
  vai riittääkö yksi rivi (3)?
- 360, Käynnissä: suunnassa 2 toiminnan sana jää pois, jotta malli mahtuu.
  Suunnassa 3 otsikko on kapein (noin 94 px).
- 1440: suunta 1 on lähes nykyinen työpöytä ilman tuplamallia ja harmaata
  laatikkoa. Suunta 2 tuo työpöydälle reunukset, jotka kierros 2 poisti.
  Suunta 3 vie työpöydälläkin Gitin, kontekstin ja kertatoiminnot ⋯-valikkoon.

## Kuvat (`kuvat/`, AVIF, laitteen skaalaus 2)

- `00-nyt-*`: tuotanto tänään labrassa.
- `01`–`02`: suunta 1, 390, vaalea ja tumma, uusi keskustelu.
- `03`–`04`: suunta 2, 390, vaalea ja tumma, uusi keskustelu.
- `05`–`07`: suunta 3, 390: uusi keskustelu, käynnissä ⋯ auki, tumma.
- `08`–`10`: suunnat 1–3, 360, käynnissä.
- `11`–`17`: suunnat 1–3, 1440: uusi keskustelu ja käynnissä, suunnassa 3 myös ⋯ auki.
