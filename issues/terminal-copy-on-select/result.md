# Tulos: kopiointi valitsemalla (kokeellinen) ja selkeä kopiointi

## Mitä tehtiin (f29e0a0e)

- Kokeellinen ominaisuus **Päätteen kopiointi valitsemalla**
  (`terminal-copy-on-select`, Asetukset › Kokeelliset ominaisuudet).
  - Valmis Shift-valinta kirjoitetaan leikepöydälle hiiren vapautuksen
    sisällä, jonka selaimet laskevat ihmisen eleeksi.
  - tmuxin oma vetovalinta (OSC 52) kopioidaan vain heti päätteessä tehdyn
    vedon jälkeen ja vain kerran. Ohjelman OSC 52 painalluksen tai klikkauksen
    jälkeen vain tarjotaan sirussa. Tämä on review-löydös: tmux, jossa on
    `set-clipboard on`, välittää ohjelmien OSC 52:n.
  - Siru näyttää "Kopioitu" ja valintamerkin, kun teksti on leikepöydällä.
- Ilman ominaisuuttakin toimivat:
  - Ctrl+Shift+C kopioi xterm.js:n valinnan tai tmuxin viimeksi ilmoittaman.
  - Macin Cmd+C toimii samoin.
  - Sirun Kopioi-painike.
- tmuxin hiiritila ei muutu: tavallinen veto, klikkaus ja rulla menevät
  tmuxille kuten ennen.
- Selitystila: uudet kortit R10 (valintasiru) ja R11 (osoitekortti).

## Todisteet

`browser-terminal.spec.ts` "copy on select…": Shift-valinta päätyy
leikepöydälle ja siru näyttää Kopioitu, Ctrl+Shift+C kopioi, ja tmuxin
tavallinen veto päätyy leikepöydälle. Kuvat (1440 ja 390, vaalea ja tumma,
skaalaus 2) ovat worker-tulosten hakemistossa. 390-kuvissa siru puuttuu,
koska kuvauksen koon muutos tyhjentää valinnan.

Elävä tarkistus: ei tehty. Tarkistettavaa: kytke ominaisuus päälle, valitse
tekstiä ja liitä se muualle. Safari ja Firefox vaativat eleen, ja Chromiumin
synteettinen testi ei todista niiden käytöstä.
